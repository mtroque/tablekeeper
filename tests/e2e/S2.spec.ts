import { readFileSync } from 'node:fs';

import { expect, test } from '@playwright/test';

// The harness reads the first _example fixture (scripts/make-example-fixtures.ts copies it).
const labels = JSON.parse(
  readFileSync(new URL('../../data/fixtures/_example/labels.json', import.meta.url), 'utf8'),
) as { items: Array<{ label: { grid: string[] } }> };
const GRID = labels.items[0]!.label.grid;

/** Longest the main thread may go without running a 16ms timer while the worker reads. */
const MAX_PAUSE_MS = 250;

test('S2: the worker reads a board off the main thread and loads opencv once', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto('/dev/cv');
  await expect(page.getByRole('heading', { name: 'Board Reader Check' })).toBeVisible();

  for (let run = 1; run <= 2; run++) {
    await page.getByRole('button', { name: 'Read Board' }).click();
    const result = page.getByTestId('cv-result');
    // The first run includes compiling the worker and opencv in next dev.
    await expect(result).toBeVisible({ timeout: 150_000 });

    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        await expect(page.getByTestId(`cell-${r}-${c}`)).toHaveAttribute(
          'data-covered',
          String(GRID[r]![c] === '#'),
        );
      }
    }
    await expect(page.getByTestId('cv-workers')).toHaveText('1');
    await expect(page.getByTestId('cv-loads')).toHaveText('1');
    const pause = Number.parseFloat((await page.getByTestId('cv-pause').textContent()) ?? '');
    expect(pause).toBeLessThan(MAX_PAUSE_MS);
  }
});
