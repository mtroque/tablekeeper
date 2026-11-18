// `pnpm dev`: web and API on the first free ports from 3000 / 4000, wired to local Postgres.
import { spawn } from 'node:child_process';

import { describeRunning, runningDevServer } from './lib/dev-lock.mjs';
import { loadLocalEnv, ROOT } from './lib/local-env.mjs';

const running = runningDevServer();
if (running) {
  console.error(describeRunning(running, { reuseHint: 'Or keep using the one that is running.' }));
  process.exit(1);
}

const { webPort, apiPort } = await loadLocalEnv({ ports: true });

const children = [
  spawn('pnpm', ['--filter', '@tablekeeper/api', 'dev'], {
    cwd: ROOT,
    stdio: 'inherit',
    env: process.env,
  }),
  spawn(
    'pnpm',
    ['--filter', '@tablekeeper/web', 'exec', 'next', 'dev', '--port', String(webPort)],
    {
      cwd: ROOT,
      stdio: 'inherit',
      env: process.env,
    },
  ),
];

console.log(`\n  Web  http://localhost:${webPort}\n  API  http://localhost:${apiPort}\n`);

let stopping = false;
function stop(code) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill('SIGTERM');
  process.exitCode = code;
}
for (const child of children) child.on('exit', (code) => stop(code ?? 0));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => stop(0));
