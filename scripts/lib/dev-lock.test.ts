import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { describeRunning, portFree, runningDevServer } from './dev-lock.mjs';

function webDirWithLock(content: string | undefined): string {
  const dir = mkdtempSync(join(tmpdir(), 'dev-lock-'));
  mkdirSync(join(dir, '.next/dev'), { recursive: true });
  if (content !== undefined) writeFileSync(join(dir, '.next/dev/lock'), content);
  return dir;
}

describe('runningDevServer', () => {
  it('returns the server while its PID is alive', () => {
    const dir = webDirWithLock(JSON.stringify({ pid: 4242, appUrl: 'http://localhost:3000' }));
    expect(runningDevServer(dir, () => true)).toEqual({
      pid: 4242,
      appUrl: 'http://localhost:3000',
    });
  });

  it('ignores a stale lock, a missing lock and unreadable content', () => {
    expect(runningDevServer(webDirWithLock(JSON.stringify({ pid: 4242 })), () => false)).toBe(
      undefined,
    );
    expect(runningDevServer(webDirWithLock(undefined), () => true)).toBe(undefined);
    expect(runningDevServer(webDirWithLock('not json'), () => true)).toBe(undefined);
  });

  it('names the PID, the URL and how to stop it', () => {
    const text = describeRunning(
      { pid: 7, appUrl: 'http://localhost:3001' },
      { reuseHint: 'Or reuse it.' },
    );
    expect(text).toContain('at http://localhost:3001 (PID 7)');
    expect(text).toContain('kill 7');
    expect(text).toContain('Or reuse it.');
  });
});

describe('portFree', () => {
  it('is false while something listens and true after it closes', async () => {
    const server = net.createServer();
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    expect(await portFree(port)).toBe(false);
    await new Promise<void>((resolve) =>
      server.close(() => {
        resolve();
      }),
    );
    expect(await portFree(port)).toBe(true);
  });
});
