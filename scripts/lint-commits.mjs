// `pnpm lint:commits`: Conventional Commits check for this branch.
// Uses COMMITLINT_FROM..COMMITLINT_TO when set (CI); otherwise commits since main on a branch, or since origin/main on main.
import { execFileSync, spawnSync } from 'node:child_process';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const exists = (ref) =>
  Boolean(ref) &&
  !/^0+$/.test(ref) &&
  spawnSync('git', ['rev-parse', '--verify', '--quiet', ref]).status === 0;

const to = exists(process.env.COMMITLINT_TO) ? process.env.COMMITLINT_TO : 'HEAD';
const branch = git('rev-parse', '--abbrev-ref', 'HEAD');
let from;
if (exists(process.env.COMMITLINT_FROM)) from = process.env.COMMITLINT_FROM;
else if (branch !== 'main' && exists('main')) from = git('merge-base', 'main', to);
else if (exists('origin/main')) from = 'origin/main';
else if (exists(`${to}~1`)) from = `${to}~1`;

const count = from ? Number(git('rev-list', '--count', `${from}..${to}`)) : 1;
if (count === 0) {
  console.log('No commits to check.');
  process.exit(0);
}
const args = from ? ['--from', from, '--to', to] : ['--last'];
const result = spawnSync('pnpm', ['exec', 'commitlint', ...args, '--verbose'], {
  stdio: 'inherit',
});
process.exit(result.status ?? 1);
