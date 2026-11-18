import { describe, expect, it } from 'vitest';

import { failureTail, lintableFiles, parseVerifyArgs, verifySteps } from '.';

describe('parseVerifyArgs and verifySteps', () => {
  it('runs the fast subset by default and the full definition of done with --full', () => {
    expect(verifySteps(parseVerifyArgs([])).map((step) => step.name)).toEqual([
      'typecheck',
      'lint',
      'lint:commits',
      'check:repo',
      'test:unit',
    ]);
    expect(verifySteps(parseVerifyArgs(['--full'])).map((step) => step.name)).toEqual([
      'typecheck',
      'lint',
      'lint:commits',
      'check:repo',
      'test',
      'test:e2e',
    ]);
    expect(parseVerifyArgs(['--keep-going']).keepGoing).toBe(true);
  });

  it('rejects unknown arguments with the usage', () => {
    expect(() => parseVerifyArgs(['--fast'])).toThrow(/Usage: pnpm verify/);
  });
});

describe('failureTail', () => {
  it('puts error lines first, drops noise and repeats, then fills with the end of the log', () => {
    const log = [
      '$ node eslint-rules/baseline.js && prettier --check .',
      'Checking formatting...',
      '\u001b[31m/repo/a.ts\u001b[0m',
      '  3:1  error  There should be no empty line within import group  import-x/order',
      '  3:1  error  There should be no empty line within import group  import-x/order',
      '✖ 1 problem (1 error, 0 warnings)',
      'last line',
    ].join('\n');
    expect(failureTail(log, 4)).toEqual([
      '  3:1  error  There should be no empty line within import group  import-x/order',
      '✖ 1 problem (1 error, 0 warnings)',
      '/repo/a.ts',
      'last line',
    ]);
  });
});

describe('lintableFiles', () => {
  it('keeps JS and TS sources once, and skips docs and type declarations', () => {
    expect(
      lintableFiles(['a.ts', 'b.tsx', 'c.mjs', 'a.ts', 'README.md', 'x.d.mts', 'y.json']),
    ).toEqual(['a.ts', 'b.tsx', 'c.mjs']);
  });
});

describe('failureTail with a web server that stopped', () => {
  it('surfaces the server lines that explain the failure', () => {
    const log = [
      '[WebServer] Your version of Next.js is affected by a known security vulnerability.',
      '[WebServer] ',
      'Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3000/',
    ].join('\n');
    expect(failureTail(log)[0]).toContain('known security vulnerability');
  });
});
