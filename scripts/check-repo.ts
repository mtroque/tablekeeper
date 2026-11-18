// `pnpm check:repo` (and `pnpm check:repo --staged` from the pre-commit hook):
// deterministic repository checks (docs/AUTOMATION.md → Enforcement map, W3).
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import {
  checkDecisionIds,
  checkFinishGate,
  checkForbiddenFiles,
  checkMigrations,
  checkOwnership,
  checkRuleIds,
  MIGRATIONS_DIR,
  type ChangedFile,
  type FileEntry,
  type MigrationDiffEntry,
} from './lib/check-repo';
import { ROOT } from './lib/local-env.mjs';

const git = (...args: string[]) =>
  execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
const refExists = (ref: string | undefined): ref is string =>
  ref !== undefined &&
  ref !== '' &&
  !/^0+$/.test(ref) &&
  spawnSync('git', ['rev-parse', '--verify', '--quiet', ref], { cwd: ROOT }).status === 0;

function resolveBaseRef(): string | undefined {
  const branch = git('rev-parse', '--abbrev-ref', 'HEAD');
  if (refExists(process.env.COMMITLINT_FROM)) return process.env.COMMITLINT_FROM;
  if (branch !== 'main' && refExists('origin/main')) {
    return git('merge-base', 'origin/main', 'HEAD');
  }
  if (branch !== 'main' && refExists('main')) {
    return git('merge-base', 'main', 'HEAD');
  }
  if (refExists('origin/main') && git('rev-parse', 'origin/main') !== git('rev-parse', 'HEAD')) {
    return 'origin/main';
  }
  return undefined;
}

function listFiles(stagedOnly: boolean): FileEntry[] {
  const raw = stagedOnly
    ? git('diff', '--cached', '--name-only', '--diff-filter=ACMR')
    : git('ls-files');
  const paths = raw
    .split(/\r?\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  const entries: FileEntry[] = [];
  for (const path of paths) {
    const abs = join(ROOT, path);
    if (!existsSync(abs)) continue;
    const stat = statSync(abs);
    if (!stat.isFile()) continue;
    entries.push({ path, sizeBytes: stat.size });
  }
  return entries;
}

function loadGameDocs(): Record<string, string> {
  const dir = join(ROOT, 'docs/games');
  const docs: Record<string, string> = {};
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.md')) continue;
    const rel = `docs/games/${name}`;
    docs[rel] = readFileSync(join(ROOT, rel), 'utf8');
  }
  return docs;
}

function loadTestFiles(): Record<string, string> {
  const files: Record<string, string> = {};
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (
        entry.name === 'node_modules' ||
        entry.name === '.next' ||
        entry.name === '.vercel' ||
        entry.name === 'dist' ||
        entry.name === '.git'
      ) {
        continue;
      }
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (/\.(?:test|spec)\.(?:ts|tsx|js)$/.test(entry.name)) {
        const rel = relative(ROOT, full).replaceAll('\\', '/');
        files[rel] = readFileSync(full, 'utf8');
      }
    }
  };
  walk(ROOT);
  return files;
}

/** Every slice spec at HEAD, path → content. */
function loadSpecs(): Record<string, string> {
  const specs: Record<string, string> = {};
  for (const name of readdirSync(join(ROOT, 'docs/slices'))) {
    const rel = `docs/slices/${name}`;
    if (SPEC_PATH.test(rel)) specs[rel] = readFileSync(join(ROOT, rel), 'utf8');
  }
  return specs;
}

/** A file's content at a ref, or undefined when it didn't exist there. */
function gitShow(ref: string, path: string): string | undefined {
  const result = spawnSync('git', ['show', `${ref}:${path}`], { cwd: ROOT, encoding: 'utf8' });
  return result.status === 0 ? result.stdout : undefined;
}

const SPEC_PATH = /^docs\/slices\/[A-Z0-9]+-.*\.md$/;

function countRemovedLines(baseRef: string, path: string): number {
  const diff = git('diff', '-U0', `${baseRef}..HEAD`, '--', path);
  let removed = 0;
  for (const line of diff.split(/\r?\n/)) {
    if (line.startsWith('-') && !line.startsWith('---')) removed += 1;
  }
  return removed;
}

function diffSinceBase(baseRef: string): {
  migrationEntries: MigrationDiffEntry[];
  changedFiles: ChangedFile[];
  specs: Record<string, string>;
  deletedSpecs: Record<string, string>;
} {
  const raw = git('diff', '--name-status', `${baseRef}..HEAD`);
  const migrationEntries: MigrationDiffEntry[] = [];
  const changedFiles: ChangedFile[] = [];
  const specs: Record<string, string> = {};
  const deletedSpecs: Record<string, string> = {};

  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const parts = line.split('\t');
    const status = parts[0] ?? '';
    const firstPath = parts[1] ?? '';
    const lastPath = parts.at(-1) ?? firstPath;

    migrationEntries.push({ status, path: firstPath });
    if (status.startsWith('D')) continue;

    changedFiles.push({
      path: lastPath,
      removedLines: status.startsWith('A') ? 0 : countRemovedLines(baseRef, lastPath),
    });

    if (SPEC_PATH.test(lastPath) && existsSync(join(ROOT, lastPath))) {
      specs[lastPath] = readFileSync(join(ROOT, lastPath), 'utf8');
    }
  }

  // A slice deletes its own spec when it finishes, often after creating it on the same branch, so
  // the net diff doesn't show it. Find deletions commit by commit; the spec's `## Owns` still
  // applies to the branch, and its last version is what the finish gate reads.
  const deleted = git(
    'log',
    '--format=',
    '--name-only',
    '--diff-filter=D',
    `${baseRef}..HEAD`,
    '--',
    'docs/slices',
  );
  for (const path of new Set(deleted.split(/\r?\n/).filter((p) => SPEC_PATH.test(p)))) {
    if (existsSync(join(ROOT, path))) continue;
    const deletedIn = git(
      'log',
      '-1',
      '--format=%H',
      '--diff-filter=D',
      `${baseRef}..HEAD`,
      '--',
      path,
    );
    if (!deletedIn) continue;
    deletedSpecs[path] = git('show', `${deletedIn}^:${path}`);
    specs[path] = deletedSpecs[path];
  }

  return { migrationEntries, changedFiles, specs, deletedSpecs };
}

const stagedOnly = process.argv.includes('--staged');
const failures: string[] = [];
const notes: string[] = [];

failures.push(...checkForbiddenFiles(listFiles(stagedOnly)));

if (!stagedOnly) {
  failures.push(...checkRuleIds(loadGameDocs(), loadTestFiles()));
  failures.push(...checkDecisionIds(readFileSync(join(ROOT, 'docs/DECISIONS.md'), 'utf8')));

  const baseRef = resolveBaseRef();
  if (baseRef) {
    const branch = git('rev-parse', '--abbrev-ref', 'HEAD');
    const { migrationEntries, changedFiles, specs, deletedSpecs } = diffSinceBase(baseRef);
    failures.push(...checkMigrations(migrationEntries, MIGRATIONS_DIR));
    const ownership = checkOwnership({ branch, changedFiles, specs });
    failures.push(...ownership.failures);
    notes.push(...ownership.notes);
    failures.push(
      ...checkFinishGate({
        deletedSpecs,
        currentSpecs: loadSpecs(),
        roadmapBase: gitShow(baseRef, 'docs/ROADMAP.md'),
        roadmapHead: readFileSync(join(ROOT, 'docs/ROADMAP.md'), 'utf8'),
      }),
    );
  }
}

for (const note of notes) console.log(`note ${note}`);
if (failures.length > 0) {
  for (const failure of failures) console.error(failure);
  process.exit(1);
}
