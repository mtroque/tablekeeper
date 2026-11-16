// `pnpm db:start | db:reset | db:types` (plus `node scripts/db.mjs migrate` for forward-only
// migration runs). Start and reset act on the one local database shared by every worktree, so
// they only run from the main checkout (AGENTS.md → Parallel sessions).
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

import { loadEnvFile, loadLocalEnv, ROOT } from './lib/local-env.mjs';
import { inWorktree } from './lib/worktree.mjs';

const require = createRequire(join(ROOT, 'apps/api/package.json'));
const { default: postgres } = await import(require.resolve('postgres'));

const command = process.argv[2];
const MIGRATIONS_DIR = join(ROOT, 'db/migrations');
const SEED_FILE = join(ROOT, 'db/seed.sql');
const RULEBOOKS_DIR = join(ROOT, 'data/rulebooks');
const TYPES_FILE = join(ROOT, 'apps/api/src/db/types.ts');
const OLD_TYPES_FILE = join(ROOT, 'apps/api/src/db/database.types.ts');

if ((command === 'start' || command === 'reset') && inWorktree()) {
  console.error(
    `pnpm db:${command} only runs from the main checkout; worktrees share its database.`,
  );
  process.exit(1);
}

// Ensures historical migrations (which reference Supabase's auth.users, auth.uid() and roles
// before 20261116120000_neon_database.sql drops them) apply cleanly on vanilla Postgres and Neon.
const AUTH_COMPAT_SQL = `
do $$
begin
  if not exists (select 1 from pg_namespace where nspname = 'auth') then
    create schema auth;
  end if;
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'auth' and table_name = 'users'
  ) then
    create table auth.users (
      id uuid primary key,
      email text,
      raw_user_meta_data jsonb
    );
  end if;
  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'auth' and p.proname = 'uid'
  ) then
    execute $fn$
      create function auth.uid() returns uuid
      language sql stable as $body$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
      $body$;
    $fn$;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin;
  end if;
end
$$;
`;

async function connect(databaseUrl) {
  if (!databaseUrl) {
    console.error('DATABASE_URL is not set.');
    process.exit(1);
  }
  const sql = postgres(databaseUrl, { max: 1, onnotice: () => {} });
  try {
    await sql`select 1`;
    return sql;
  } catch (error) {
    await sql.end();
    if (error?.code !== '3D000') throw error;
    const url = new URL(databaseUrl);
    const dbName = url.pathname.replace(/^\//, '');
    if (!/^[a-z_][a-z0-9_]*$/i.test(dbName)) throw error;
    url.pathname = '/postgres';
    const admin = postgres(url.toString(), { max: 1, onnotice: () => {} });
    try {
      await admin.unsafe(`create database "${dbName}"`);
    } finally {
      await admin.end();
    }
    return postgres(databaseUrl, { max: 1, onnotice: () => {} });
  }
}

async function applyMigrations(sql) {
  await sql.unsafe(AUTH_COMPAT_SQL);
  await sql.unsafe(`
    create table if not exists public.schema_migrations (
      version text primary key,
      applied_at timestamptz not null default now()
    );
  `);
  const appliedRows = await sql`select version from public.schema_migrations`;
  const applied = new Set(appliedRows.map((row) => row.version));
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith('.sql'))
    .sort();

  for (const name of files) {
    if (applied.has(name)) continue;
    const content = readFileSync(join(MIGRATIONS_DIR, name), 'utf8');
    await sql.begin(async (tx) => {
      await tx.unsafe(content);
      await tx`insert into public.schema_migrations (version) values (${name})`;
    });
    console.log(`Applied ${name}`);
  }
}

async function loadReviewedRulebooks(sql) {
  if (!existsSync(RULEBOOKS_DIR)) return;
  const files = readdirSync(RULEBOOKS_DIR)
    .filter((name) => name.endsWith('.sections.json'))
    .sort();
  for (const file of files) {
    const raw = JSON.parse(readFileSync(join(RULEBOOKS_DIR, file), 'utf8'));
    const pRulebook = {
      game_id: raw.gameId,
      edition: raw.rulebook.edition,
      title: raw.rulebook.title,
      publisher_url: raw.rulebook.publisherUrl,
      source_version: raw.sourceVersion,
    };
    const pSections = raw.sections.map((s) => ({
      key: s.key,
      parent_key: s.parentKey,
      ordinal: s.ordinal,
      number: s.number,
      title: s.title,
      pdf_page_start: s.pdfPageStart,
      pdf_page_end: s.pdfPageEnd,
      printed_pages: s.printedPages,
      body: s.body,
    }));
    await sql`select public.replace_rulebook(${sql.json(pRulebook)}, ${sql.json(pSections)})`;
  }
}

function pascalCase(snake) {
  return snake
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

function tsType(dataType, isNullable) {
  let base;
  switch (dataType) {
    case 'uuid':
    case 'text':
    case 'date':
    case 'timestamp with time zone':
    case 'tsvector':
      base = 'string';
      break;
    case 'integer':
    case 'bigint':
      base = 'number';
      break;
    case 'boolean':
      base = 'boolean';
      break;
    case 'jsonb':
      base = 'unknown';
      break;
    default:
      base = 'unknown';
  }
  if (base === 'unknown') return 'unknown';
  return isNullable === 'YES' ? `${base} | null` : base;
}

switch (command) {
  case 'start': {
    // Local Supabase stays up for Auth until X4; Postgres inside it serves DATABASE_URL.
    loadEnvFile();
    process.env.SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID ??= '';
    process.env.SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET ??= '';
    const result = spawnSync('supabase', ['start'], {
      cwd: ROOT,
      stdio: 'inherit',
      env: process.env,
    });
    process.exit(result.status ?? 1);
    break;
  }
  case 'migrate': {
    await loadLocalEnv();
    const sql = await connect(process.env.DATABASE_URL);
    try {
      await applyMigrations(sql);
    } finally {
      await sql.end();
    }
    break;
  }
  case 'reset': {
    await loadLocalEnv();
    const sql = await connect(process.env.DATABASE_URL);
    try {
      await sql.unsafe(AUTH_COMPAT_SQL);
      await sql.unsafe(`
        drop trigger if exists on_auth_user_created on auth.users;
        drop schema if exists public cascade;
        create schema public;
        grant all on schema public to public;
      `);
      await applyMigrations(sql);
      if (existsSync(SEED_FILE)) {
        await sql.unsafe(readFileSync(SEED_FILE, 'utf8'));
        console.log('Seeded public.profiles');
      }
      await loadReviewedRulebooks(sql);
    } finally {
      await sql.end();
    }
    break;
  }
  case 'types': {
    await loadLocalEnv();
    const sql = await connect(process.env.DATABASE_URL);
    try {
      const columns = await sql`
        select table_name, column_name, data_type, is_nullable
        from information_schema.columns
        where table_schema = 'public' and table_name <> 'schema_migrations'
        order by table_name, ordinal_position
      `;
      const byTable = new Map();
      for (const col of columns) {
        const list = byTable.get(col.table_name) ?? [];
        list.push(col);
        byTable.set(col.table_name, list);
      }
      const blocks = ['// Generated by `pnpm db:types`. Do not edit.'];
      for (const [table, cols] of byTable.entries()) {
        const fields = cols.map(
          (col) => `  ${col.column_name}: ${tsType(col.data_type, col.is_nullable)};`,
        );
        blocks.push(`export type ${pascalCase(table)}Row = {\n${fields.join('\n')}\n};`);
      }
      writeFileSync(TYPES_FILE, `${blocks.join('\n\n')}\n`);
      if (existsSync(OLD_TYPES_FILE)) rmSync(OLD_TYPES_FILE);
      console.log(`Wrote ${TYPES_FILE}`);
    } finally {
      await sql.end();
    }
    break;
  }
  default:
    console.error('Usage: node scripts/db.mjs start|reset|migrate|types');
    process.exit(1);
}
