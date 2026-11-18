// pnpm fix [--staged]
// Formats and lint-fixes the files this branch changed (vs origin/main, plus uncommitted and
// untracked files), or only staged ones: Prettier, then `eslint --fix`, which also sorts imports.
// `pnpm format` alone leaves import order to fail `pnpm lint` (docs/CONVENTIONS.md → Commands for agents).
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { ROOT } from './lib/local-env.mjs';
import { lintableFiles } from './lib/verify';

const git = (...args: string[]) =>
  execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' })
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

function changedFiles(staged: boolean): string[] {
  if (staged) return git('diff', '--cached', '--name-only', '--diff-filter=ACMR');
  const base = spawnSync('git', ['merge-base', 'origin/main', 'HEAD'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  const committed =
    base.status === 0
      ? git('diff', '--name-only', '--diff-filter=ACMR', base.stdout.trim(), 'HEAD')
      : [];
  return [
    ...committed,
    ...git('diff', '--name-only', '--diff-filter=ACMR'),
    ...git('diff', '--cached', '--name-only', '--diff-filter=ACMR'),
    ...git('ls-files', '--others', '--exclude-standard'),
  ];
}

const staged = process.argv.includes('--staged');
const files = [...new Set(changedFiles(staged))].filter((path) => existsSync(join(ROOT, path)));
if (files.length === 0) {
  console.log('Nothing changed to fix.');
  process.exit(0);
}

const run = (command: string, args: string[]) =>
  spawnSync('pnpm', ['exec', command, ...args], { cwd: ROOT, stdio: 'inherit' }).status ?? 1;

let code = run('prettier', ['--write', '--log-level', 'warn', '--ignore-unknown', ...files]);
const lintable = lintableFiles(files);
if (lintable.length > 0) code ||= run('eslint', ['--fix', '--no-warn-ignored', ...lintable]);
console.log(
  code === 0 ? `Fixed ${files.length} files.` : 'Some problems need a manual fix (above).',
);
process.exit(code);
