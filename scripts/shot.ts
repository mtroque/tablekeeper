// pnpm shot <route> [--signed-in [user]] [--offline] [--dark] [--wait <selector>]
// Screenshots a route at phone size (390x844) into .scratch/<branch>/shots/.
import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { chromium } from '@playwright/test';

import { signInAs } from '../tests/e2e/helpers';

import { describeRunning, runningDevServer, waitUntilStopped } from './lib/dev-lock.mjs';
import { loadLocalEnv, ROOT } from './lib/local-env.mjs';
import { parseShotArgs, sanitizeBranchName, shotFilename } from './lib/shot-args';

const VIEWPORT = { width: 390, height: 844 };

async function waitForUrl(url: string, timeoutMs = 60_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // Server still starting.
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function currentBranch(): string {
  try {
    return execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd: ROOT,
      encoding: 'utf8',
    }).trim();
  } catch {
    return 'local';
  }
}

async function startServers() {
  const running = runningDevServer();
  if (running) {
    console.error(
      describeRunning(running, {
        reuseHint: `Or shoot against it: SHOT_URL=${running.appUrl ?? 'http://localhost:<port>'} pnpm shot … (signed-in shots need the test API pnpm shot starts itself).`,
      }),
    );
    process.exit(1);
  }
  const { webPort, apiPort } = await loadLocalEnv({ ports: true });
  const apiEnv = {
    ...process.env,
    NODE_ENV: 'test',
    LOG_LEVEL: 'warn',
    LLM_PROVIDER: 'fake',
    RATE_LIMIT_MAX: '100000',
  };
  const webEnv = {
    ...process.env,
    NEXT_PUBLIC_ENABLE_PHOTO_SCORING: 'true',
  };
  const children: ChildProcess[] = [
    spawn('pnpm', ['--filter', '@tablekeeper/api', 'exec', 'tsx', 'src/server.ts'], {
      cwd: ROOT,
      stdio: 'ignore',
      env: apiEnv,
      detached: true,
    }),
    spawn(
      'pnpm',
      [
        '--filter',
        '@tablekeeper/web',
        'exec',
        'next',
        'dev',
        '--hostname',
        '127.0.0.1',
        '--port',
        String(webPort),
      ],
      {
        cwd: ROOT,
        stdio: 'ignore',
        env: webEnv,
        detached: true,
      },
    ),
  ];

  const stop = async () => {
    await Promise.all(
      children.map(
        (child) =>
          new Promise<void>((resolve) => {
            if (child.exitCode !== null || child.pid === undefined) {
              resolve();
              return;
            }
            child.once('exit', () => {
              resolve();
            });
            try {
              process.kill(-child.pid, 'SIGTERM');
            } catch {
              resolve();
            }
          }),
      ),
    );
    // The pnpm wrappers exit before next dev and the API have let go of the ports and Next's
    // dev lock, so a chained `pnpm shot` would otherwise race them.
    if (!(await waitUntilStopped([webPort, apiPort]))) {
      console.error(`Servers on ports ${webPort} and ${apiPort} didn't stop within 15s.`);
    }
  };
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => {
      void stop().then(() => process.exit(130));
    });
  }

  try {
    await Promise.all([
      waitForUrl(`http://127.0.0.1:${apiPort}/health`),
      waitForUrl(`http://127.0.0.1:${webPort}/`),
    ]);
    return { baseUrl: `http://127.0.0.1:${webPort}`, stop };
  } catch (error) {
    await stop();
    throw error;
  }
}

let opts;
try {
  opts = parseShotArgs(process.argv.slice(2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(2);
}

const shotUrl = process.env.SHOT_URL;
const server = shotUrl
  ? { baseUrl: shotUrl.replace(/\/$/, ''), stop: async () => {} }
  : await startServers();
if (shotUrl) {
  await loadLocalEnv({ exitOnError: false }).catch(() => {});
}

const branchDir = sanitizeBranchName(currentBranch());
const outDir = join(ROOT, '.scratch', branchDir, 'shots');
mkdirSync(outDir, { recursive: true });
const outFile = join(outDir, shotFilename(opts));

try {
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({
      viewport: VIEWPORT,
      colorScheme: opts.dark ? 'dark' : 'light',
    });
    const page = await context.newPage();
    if (opts.signedInUser) {
      await signInAs(page, opts.signedInUser);
    }
    const targetUrl = `${server.baseUrl}${opts.route}`;
    const waitUntil = opts.waitSelector ? 'domcontentloaded' : 'networkidle';
    try {
      await page.goto(targetUrl, { waitUntil });
    } catch {
      await page.waitForTimeout(500);
      await page.goto(targetUrl, { waitUntil });
    }
    if (opts.waitSelector) {
      await page.locator(opts.waitSelector).first().waitFor({ state: 'visible', timeout: 15_000 });
    } else {
      // Wait for client hydration and loading skeletons to settle.
      await page
        .waitForFunction(
          () => !document.querySelector('[aria-busy="true"], [data-slot="skeleton"]'),
          undefined,
          { timeout: 10_000 },
        )
        .catch(() => {});
      await page.waitForTimeout(200);
    }
    if (opts.offline) {
      await context.setOffline(true);
      await page.evaluate(() => window.dispatchEvent(new Event('offline')));
      await page.waitForTimeout(300);
    }
    await page.screenshot({ path: outFile, fullPage: true });
    console.log(outFile);
  } finally {
    await browser.close();
  }
} finally {
  await server.stop();
}
