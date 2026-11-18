// Runs the builder with its output going straight to files, so no output size can crash the
// runner (W27: `spawnSync` buffering crashed two factory runs), and reads the session id back.
import { spawnSync } from 'node:child_process';
import { closeSync, existsSync, openSync, readSync, statSync } from 'node:fs';

export type SpawnToFilesResult = {
  status: number | null;
  signal: NodeJS.Signals | null;
  error: Error | undefined;
};

export function spawnToFiles(
  command: string,
  args: readonly string[],
  opts: {
    cwd: string;
    env?: NodeJS.ProcessEnv;
    timeoutMs?: number;
    stdoutPath: string;
    stderrPath: string;
  },
): SpawnToFilesResult {
  const out = openSync(opts.stdoutPath, 'w');
  const err = openSync(opts.stderrPath, 'w');
  try {
    const res = spawnSync(command, args, {
      cwd: opts.cwd,
      env: opts.env ?? process.env,
      ...(opts.timeoutMs ? { timeout: opts.timeoutMs } : {}),
      stdio: ['ignore', out, err],
    });
    return { status: res.status, signal: res.signal, error: res.error };
  } finally {
    closeSync(out);
    closeSync(err);
  }
}

const CHUNK = 1024 * 1024;

/** The first `session_id` in a stream-json file, read a chunk at a time. */
export function sessionIdFromStreamFile(path: string): string | null {
  if (!existsSync(path)) return null;
  const fd = openSync(path, 'r');
  try {
    const buffer = Buffer.alloc(CHUNK);
    let carry = '';
    let position = 0;
    for (;;) {
      const read = readSync(fd, buffer, 0, CHUNK, position);
      if (read === 0) break;
      position += read;
      const lines = (carry + buffer.toString('utf8', 0, read)).split(/\r?\n/);
      carry = lines.pop() ?? '';
      for (const line of lines) {
        const id = sessionIdFromLine(line);
        if (id) return id;
      }
    }
    return sessionIdFromLine(carry);
  } finally {
    closeSync(fd);
  }
}

function sessionIdFromLine(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith('{')) return null;
  try {
    const obj = JSON.parse(trimmed) as { session_id?: unknown };
    return typeof obj.session_id === 'string' && obj.session_id ? obj.session_id : null;
  } catch {
    return null;
  }
}

/** The last `count` non-empty lines of a file, reading at most its last `maxBytes`. */
export function tailOfFile(path: string, count: number, maxBytes = 64 * 1024): string[] {
  if (!existsSync(path)) return [];
  const size = statSync(path).size;
  const length = Math.min(size, maxBytes);
  const fd = openSync(path, 'r');
  try {
    const buffer = Buffer.alloc(length);
    readSync(fd, buffer, 0, length, size - length);
    return buffer
      .toString('utf8')
      .split(/\r?\n/)
      .filter((line) => line.trim().length > 0)
      .slice(-count);
  } finally {
    closeSync(fd);
  }
}
