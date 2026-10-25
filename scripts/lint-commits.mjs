// `pnpm lint:commits`: Conventional Commits check for this branch.
// On a branch: commits since main. On main: commits since origin/main, or the last commit.
import { execFileSync, spawnSync } from 'node:child_process';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const exists = (ref) => spawnSync('git', ['rev-parse', '--verify', '--quiet', ref]).status === 0;

const branch = git('rev-parse', '--abbrev-ref', 'HEAD');
let from;
if (branch !== 'main' && exists('main')) from = git('merge-base', 'main', 'HEAD');
else if (exists('origin/main')) from = 'origin/main';
else if (exists('HEAD~1')) from = 'HEAD~1';

const count = from ? Number(git('rev-list', '--count', `${from}..HEAD`)) : 1;
if (count === 0) {
  console.log('No commits to check.');
  process.exit(0);
}
const args = from ? ['--from', from, '--to', 'HEAD'] : ['--last'];
const result = spawnSync('pnpm', ['exec', 'commitlint', ...args, '--verbose'], {
  stdio: 'inherit',
});
process.exit(result.status ?? 1);
