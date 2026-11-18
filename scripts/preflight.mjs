// `pnpm preflight`: the checks agents need before building, without reading .env.local
// (settings deny that). Prints one line per check and exits 1 if a required one fails. On CI
// runners (`CI` set) `.env.local` is optional: workflows pass env vars, and the local defaults fill
// the rest.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import net from 'node:net';
import { join } from 'node:path';

import { LOCAL_DATABASE_URL, loadEnvFile, NOT_RUNNING, ROOT } from './lib/local-env.mjs';
import { inWorktree } from './lib/worktree.mjs';

function quiet(cmd, args) {
  try {
    return execFileSync(cmd, args, {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return undefined;
  }
}

function canConnect(urlString) {
  return new Promise((resolve) => {
    let url;
    try {
      url = new URL(urlString);
    } catch {
      resolve(false);
      return;
    }
    const port = Number(url.port) || 5432;
    const socket = net.createConnection({ host: url.hostname, port, timeout: 1500 });
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => resolve(false));
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
  });
}

const env = {};
loadEnvFile(env);
const dbRunning = await canConnect(env.DATABASE_URL || LOCAL_DATABASE_URL);
const branch = quiet('git', ['branch', '--show-current']) ?? '(detached)';
const dirty = quiet('git', ['status', '--porcelain']);

const onCi = Boolean(process.env.CI);
const hasEnvFile = existsSync(join(ROOT, '.env.local'));

/** Required checks: [label, ok, fix]. */
const required = [
  ['node_modules installed', existsSync(join(ROOT, 'node_modules')), 'Run pnpm install.'],
  ...(onCi
    ? []
    : [['.env.local present', hasEnvFile, 'cp .env.example .env.local (README → Run locally).']]),
  ['local Postgres running', dbRunning, NOT_RUNNING],
];

console.log(`branch      ${branch}${inWorktree() ? ' (worktree)' : ' (main checkout)'}`);
console.log(`tree        ${dirty === '' ? 'clean' : 'has changes'}`);
if (onCi && !hasEnvFile) {
  console.log('info        no .env.local: not needed on CI (env vars come from the workflow)');
}
let failed = false;
for (const [label, ok, fix] of required) {
  console.log(`${ok ? 'ok  ' : 'MISS'}        ${label}${ok ? '' : `: ${fix}`}`);
  failed ||= !ok;
}
process.exit(failed ? 1 : 0);
