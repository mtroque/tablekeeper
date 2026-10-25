import { execFileSync } from 'node:child_process';

/** True when running in a linked git worktree rather than the main checkout. */
export function inWorktree(cwd = process.cwd()) {
  const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
  try {
    return (
      git('rev-parse', '--path-format=absolute', '--git-dir') !==
      git('rev-parse', '--path-format=absolute', '--git-common-dir')
    );
  } catch {
    return false;
  }
}
