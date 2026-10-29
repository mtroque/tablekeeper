// `pnpm test:build`: the production check from docs/slices/S4-cv-worker-detectors.md. Builds
// apps/web with the default bundler (Turbopack) and fails if that takes too long, which is how an
// import loop through the CV worker shows up. Then runs tests/e2e/S4.spec.ts against `next start`.
import { spawn } from 'node:child_process';

import { loadLocalEnv, ROOT } from './lib/local-env.mjs';

/** A clean build takes well under a minute; the worker import loop hung forever. */
const BUILD_LIMIT_MS = 180_000;

// Ports first: the build bakes the API URL in, and the Playwright config reuses these ports.
await loadLocalEnv({ ports: true });
// The /dev/cv harness, which starts the worker, exists in production only with this flag.
process.env.NEXT_PUBLIC_ENABLE_EXAMPLE_GAME = 'true';

/** Runs a command from the repo root; resolves with its exit code, or `null` after `limitMs`. */
function run(command, args, { env = process.env, limitMs } = {}) {
  return new Promise((resolve) => {
    // Its own process group, so a timeout also stops the build's worker processes.
    const child = spawn(command, args, { cwd: ROOT, env, stdio: 'inherit', detached: true });
    const timer = limitMs
      ? setTimeout(() => {
          process.kill(-child.pid, 'SIGKILL');
          resolve(null);
        }, limitMs)
      : undefined;
    child.on('exit', (code) => {
      clearTimeout(timer);
      resolve(code ?? 1);
    });
  });
}

const started = Date.now();
// .env.local sets NODE_ENV=development for the API; a build with it fails to prerender.
const built = await run('pnpm', ['--filter', '@tablekeeper/web', 'exec', 'next', 'build'], {
  env: { ...process.env, NODE_ENV: 'production' },
  limitMs: BUILD_LIMIT_MS,
});
if (built === null) {
  console.error(
    `next build didn't finish in ${BUILD_LIMIT_MS / 1000}s. Check that apps/web/src/workers/cv.worker.ts doesn't import the game UI.`,
  );
  process.exit(1);
}
if (built !== 0) process.exit(built);
console.log(`next build finished in ${((Date.now() - started) / 1000).toFixed(1)}s.`);

process.exit(
  (await run('pnpm', [
    'exec',
    'playwright',
    'test',
    '--config',
    'tests/build/playwright.config.ts',
  ])) ?? 1,
);
