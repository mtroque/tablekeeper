import { readFileSync } from 'node:fs';

import { expect, test } from '@playwright/test';

// Runs against `next dev` in `pnpm test:e2e` and against a production build served with
// `next start` in `pnpm test:build` (tests/build/playwright.config.ts).
const labels = JSON.parse(
  readFileSync(new URL('../../data/fixtures/_example/labels.json', import.meta.url), 'utf8'),
) as { items: Array<{ label: { grid: string[] } }> };
const GRID = labels.items[0]!.label.grid;

test('S4: the CV worker loads its detector and answers without page errors', async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/dev/cv');
  await expect(page.getByRole('heading', { name: 'Board Reader Check' })).toBeVisible();
  await page.getByRole('button', { name: 'Read Board' }).click();
  // In next dev, the first read includes compiling the worker and opencv.
  await expect(page.getByTestId('cv-result')).toBeVisible({ timeout: 150_000 });

  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      await expect(page.getByTestId(`cell-${r}-${c}`)).toHaveAttribute(
        'data-covered',
        String(GRID[r]![c] === '#'),
      );
    }
  }
  // Both come from the worker's reply to a `stats` message.
  await expect(page.getByTestId('cv-workers')).toHaveText('1');
  await expect(page.getByTestId('cv-loads')).toHaveText('1');
  expect(errors).toEqual([]);
});
