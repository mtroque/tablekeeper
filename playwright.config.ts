import { defineConfig, devices } from '@playwright/test';

import { loadLocalEnv } from './scripts/lib/local-env.mjs';

// Picks free ports once and stores them in process.env, so test workers (which re-read this
// file) inherit the same ports instead of picking new ones.
const { webPort, apiPort } = await loadLocalEnv({ ports: true });
const env = Object.fromEntries(
  Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined),
);
// S1's e2e test plays the example game.
env.NEXT_PUBLIC_ENABLE_EXAMPLE_GAME = 'true';
// S1 and S2 test the photo flow, which production keeps off until S4 (D-055).
env.NEXT_PUBLIC_ENABLE_PHOTO_SCORING = 'true';

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${webPort}`,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'phone', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 } } },
  ],
  webServer: [
    {
      command: 'pnpm --filter @tablekeeper/api exec tsx src/server.ts',
      url: `http://localhost:${apiPort}/health`,
      env: { ...env, NODE_ENV: 'test', LOG_LEVEL: 'warn', LLM_PROVIDER: 'fake' },
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: `pnpm --filter @tablekeeper/web exec next dev --port ${webPort}`,
      url: `http://localhost:${webPort}`,
      env,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
