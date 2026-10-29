import { defineConfig, devices } from '@playwright/test';

import { loadLocalEnv } from '../../scripts/lib/local-env.mjs';

// `pnpm test:build` (scripts/test-build.mjs): S4's e2e test against the production build it just
// made. The script picks the ports before building, so the URLs baked into the build match.
const { webPort, apiPort } = await loadLocalEnv({ ports: true });
const env = Object.fromEntries(
  Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined),
);

export default defineConfig({
  testDir: '../e2e',
  testMatch: 'S4.spec.ts',
  forbidOnly: !!process.env.CI,
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
      command: `pnpm --filter @tablekeeper/web exec next start --port ${webPort}`,
      url: `http://localhost:${webPort}`,
      env: { ...env, NODE_ENV: 'production' },
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
