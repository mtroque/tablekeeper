import { spawnSync } from 'node:child_process';

import { describe, expect, it } from 'vitest';

import { requireScopeExceptMerge } from '../commitlint.config.js';
import { ROOT } from './lib/local-env.mjs';

function runCommitlint(message: string) {
  return spawnSync('pnpm', ['exec', 'commitlint'], {
    cwd: ROOT,
    input: message,
    encoding: 'utf8',
  });
}

describe('commitlint.config.js', () => {
  it('accepts scoped commits including the docs scope', () => {
    expect(runCommitlint('docs(docs): update readme note').status).toBe(0);
    expect(runCommitlint('feat(workflow): add harden skill').status).toBe(0);
  });

  it('accepts scopeless merge commits from /merge', () => {
    expect(runCommitlint('docs: merge slice/W5').status).toBe(0);
  });

  it('rejects dropping the scope on non-merge commits', () => {
    const result = runCommitlint('docs: drop scope after rejection');
    expect(result.status).not.toBe(0);
    expect(result.stdout + result.stderr).toContain('require-scope-except-merge');
  });

  it('rejects unlisted scopes and headers over 72 characters', () => {
    expect(runCommitlint('docs(readme): add note').status).not.toBe(0);
    expect(runCommitlint(`feat(workflow): ${'a'.repeat(57)}`).status).not.toBe(0);
  });

  it('requireScopeExceptMerge reports a fix-naming message when scope is missing', () => {
    const [ok, message] = requireScopeExceptMerge({
      type: 'feat',
      scope: null,
      subject: 'something',
    });
    expect(ok).toBe(false);
    expect(message).toContain('commitlint.config.js');
  });
});
