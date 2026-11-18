import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

import { LocalEnvError, loadLocalEnv } from './scripts/lib/local-env.mjs';

// API integration tests run against local Postgres; this fills local defaults when unset.
await loadLocalEnv({ exitOnError: false }).catch((error: unknown) => {
  if (!(error instanceof LocalEnvError)) throw error;
});

const webSrc = fileURLToPath(new URL('./apps/web/src', import.meta.url));
const parsedSeed = process.env.FC_SEED ? Number.parseInt(process.env.FC_SEED, 10) : NaN;
const fcSeed = Number.isFinite(parsedSeed) ? parsedSeed : process.env.CI ? 42 : null;

export default defineConfig({
  test: {
    passWithNoTests: true,
    projects: [
      {
        define: { 'globalThis.__FC_SEED__': JSON.stringify(fcSeed) },
        test: { name: 'core', include: ['packages/core/src/**/*.test.ts'] },
      },
      { test: { name: 'cv', include: ['packages/cv/src/**/*.test.ts'] } },
      {
        test: {
          name: 'tooling',
          include: ['eslint-rules/**/*.test.js', 'scripts/**/*.test.{js,ts}'],
        },
      },
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
