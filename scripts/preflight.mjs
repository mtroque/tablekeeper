// `pnpm preflight`: the checks agents need before building, without reading .env.local
// (settings deny that). Prints one line per check and exits 1 if a required one fails.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { NOT_RUNNING, ROOT } from './lib/local-env.mjs';
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

const branch = quiet('git', ['branch', '--show-current']) ?? '(detached)';
const dirty = quiet('git', ['status', '--porcelain']);

/** Required checks: [label, ok, fix]. */
const required = [
  ['node_modules installed', existsSync(join(ROOT, 'node_modules')), 'Run pnpm install.'],
  [
    '.env.local present',
    existsSync(join(ROOT, '.env.local')),
    'cp .env.example .env.local (README → Run locally).',
  ],
  // `supabase status` exits non-zero when the stack is down; its output (keys) is never printed.
  ['local Supabase running', quiet('supabase', ['status', '-o', 'env']) !== undefined, NOT_RUNNING],
];

console.log(`branch      ${branch}${inWorktree() ? ' (worktree)' : ' (main checkout)'}`);
console.log(`tree        ${dirty === '' ? 'clean' : 'has changes'}`);
let failed = false;
for (const [label, ok, fix] of required) {
  console.log(`${ok ? 'ok  ' : 'MISS'}        ${label}${ok ? '' : `: ${fix}`}`);
  failed ||= !ok;
}
process.exit(failed ? 1 : 0);
