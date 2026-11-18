// Next allows one `next dev` per app directory and records it in `.next/dev/lock` (JSON with `pid`
// and `appUrl`). The file can outlive the process, so a lock only counts while its PID is alive.
// Used by `pnpm dev`, `pnpm shot` and the e2e config to explain a running server up front, and to
// wait until a server they started has really gone (AGENTS.md → Parallel sessions).
import { readFileSync } from 'node:fs';
import net from 'node:net';
import { join } from 'node:path';

import { ROOT } from './local-env.mjs';

export const WEB_DIR = join(ROOT, 'apps/web');

/** True while a process with this PID exists (signal 0 only checks). */
export function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === 'EPERM';
  }
}

/** The `next dev` holding the app's lock, or undefined when there's none or it's stale. */
export function runningDevServer(webDir = WEB_DIR, alive = isAlive) {
  let info;
  try {
    info = JSON.parse(readFileSync(join(webDir, '.next/dev/lock'), 'utf8'));
  } catch {
    return undefined;
  }
  const pid = Number(info?.pid);
  if (!Number.isInteger(pid) || pid <= 0 || !alive(pid)) return undefined;
  return { pid, appUrl: typeof info.appUrl === 'string' ? info.appUrl : undefined };
}

/** One message naming the running server and both ways forward. */
export function describeRunning(server, { reuseHint } = {}) {
  const where = server.appUrl ? ` at ${server.appUrl}` : '';
  const lines = [
    `A next dev server is already running for apps/web${where} (PID ${server.pid}); Next allows one per app.`,
    `Stop it with: kill ${server.pid}`,
  ];
  if (reuseHint) lines.push(reuseHint);
  return lines.join('\n');
}

/** True when nothing accepts connections on the port. */
export function portFree(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host });
    socket.once('connect', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('error', () => resolve(true));
  });
}

/** Waits until the ports are free and the app's dev lock is released (or stale). */
export async function waitUntilStopped(ports, { timeoutMs = 15_000, webDir = WEB_DIR } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const free = await Promise.all(ports.map((port) => portFree(port)));
    if (free.every(Boolean) && !runningDevServer(webDir)) return true;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  return false;
}
