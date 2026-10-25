import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

import { loadLocalEnv } from './scripts/lib/local-env.mjs';

// API integration tests run against local Supabase; this fills its URL and keys.
await loadLocalEnv();

const webSrc = fileURLToPath(new URL('./apps/web/src', import.meta.url));

export default defineConfig({
  test: {
    passWithNoTests: true,
    projects: [
      { test: { name: 'core', include: ['packages/core/src/**/*.test.ts'] } },
      { test: { name: 'cv', include: ['packages/cv/src/**/*.test.ts'] } },
      { test: { name: 'tooling', include: ['eslint-rules/**/*.test.js', 'scripts/**/*.test.js'] } },
      {
        test: {
          name: 'api',
          include: ['apps/api/src/**/*.test.ts'],
          env: { NODE_ENV: 'test', LOG_LEVEL: 'silent' },
          testTimeout: 20_000,
          hookTimeout: 30_000,
        },
      },
      {
        resolve: { alias: { '@': webSrc } },
        test: { name: 'web', include: ['apps/web/src/**/*.test.{ts,tsx}'] },
      },
    ],
  },
});
