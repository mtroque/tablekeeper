// One shot per screen map entry (tests/e2e/screens.ts), written to test-results/screens/<id>.png.
// Runs only with SCREENS=1 (playwright.config.ts): the `Screens` workflow, not the E2E job.
import { join } from 'node:path';

import { test } from '@playwright/test';

import { SCREENS, shootScreen } from './screens';

const OUT_DIR = join(process.cwd(), 'test-results', 'screens');

for (const entry of SCREENS) {
  test(`${entry.id} (${entry.screen}, ${entry.state})`, async ({ browser }, testInfo) => {
    // The first photo read loads opencv; dev compiles each route on first visit.
    test.setTimeout(120_000);
    const baseURL = testInfo.project.use.baseURL;
    if (!baseURL) throw new Error('baseURL missing from playwright.config.ts');
    await shootScreen(entry, { browser, baseURL, path: join(OUT_DIR, `${entry.id}.png`) });
  });
}
