import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createSupabaseClients } from './db/client';
import { testConfig } from './test/helpers';

const run = promisify(execFile);
const SALT = 'x2-vercel-test';
const IP = '203.0.113.99';
const API_ROOT = join(import.meta.dirname, '..');

// Loads the built function the way Vercel's Node launcher does (module.exports is the
// `(req, res)` handler), in plain Node, from a folder with no node_modules anywhere above it.
const SERVE = `
const http = require('node:http');
const handler = require(process.argv[1]);
const server = http.createServer(handler).listen(0, async () => {
  const base = 'http://127.0.0.1:' + server.address().port;
  const health = await fetch(base + '/health');
  const games = await fetch(base + '/v1/games', { headers: { 'x-forwarded-for': process.argv[2] } });
  console.log(JSON.stringify({
    health: await health.json(),
    games: games.status,
    limit: games.headers.get('ratelimit-policy'),
  }));
  server.close();
});
`;

let output: string;

beforeAll(async () => {
  output = await mkdtemp(join(tmpdir(), 'tk-vercel-'));
  await run('node', [join(API_ROOT, 'scripts/build-vercel.mjs'), output]);
}, 60_000);

afterAll(async () => {
  await rm(output, { recursive: true, force: true });
  const key = createHash('sha256').update(`${SALT}:${IP}`).digest('hex');
  await createSupabaseClients(testConfig().supabase)
    .service.from('rate_limit_hits')
    .delete()
    .eq('key', `burst:${key}`);
});

describe('pnpm build:vercel', () => {
  it('routes every path to one Node function', async () => {
    const config: unknown = JSON.parse(await readFile(join(output, 'config.json'), 'utf8'));
    expect(config).toEqual({ version: 3, routes: [{ src: '/(.*)', dest: '/index' }] });
    const vc: unknown = JSON.parse(
      await readFile(join(output, 'functions/index.func/.vc-config.json'), 'utf8'),
    );
    expect(vc).toMatchObject({
      runtime: 'nodejs22.x',
      handler: 'index.cjs',
      launcherType: 'Nodejs',
    });
  });

  it('answers /health and /v1 in production mode with the database burst store', async () => {
    const { supabase } = testConfig();
    const { stdout } = await run(
      'node',
      ['-e', SERVE, join(output, 'functions/index.func/index.cjs'), IP],
      {
        cwd: output,
        env: {
          PATH: process.env.PATH,
          NODE_ENV: 'production',
          LOG_LEVEL: 'silent',
          IP_HASH_SALT: SALT,
          SUPABASE_URL: supabase.url,
          SUPABASE_ANON_KEY: supabase.anonKey,
          SUPABASE_SERVICE_ROLE_KEY: supabase.serviceRoleKey,
          LLM_PROVIDER: 'fake',
        },
      },
    );
    expect(JSON.parse(stdout)).toMatchObject({ health: { ok: true }, games: 200 });
    expect((JSON.parse(stdout) as { limit: string }).limit).toMatch(/^"60-in-1min"; q=60; w=60/);
  });
});
