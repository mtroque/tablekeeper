import { expect, test, type Page } from '@playwright/test';

const SCORE = '/games/patchwork/score';

/** Opens a sample photo and waits until it is read and the corners are shown. */
async function openSample(page: Page, name: string): Promise<void> {
  await page.goto(SCORE);
  await page.getByRole('button', { name }).click();
  await expect(page).toHaveURL(/\/score\/capture$/);
  // The first read loads opencv in the worker; give it time.
  await expect(page.getByRole('button', { name: 'Read Board' })).toBeVisible({ timeout: 60_000 });
}

async function review(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Read Board' }).click();
  await expect(page).toHaveURL(/\/score\/review$/, { timeout: 30_000 });
}

const count = (page: Page, value: number) =>
  page.getByRole('button', { name: new RegExp(`^Chits of ${value}: \\d+\\.`) });

test('the chits and special tile beside the box board are read into the draft', async ({
  page,
}) => {
  await openSample(page, 'Try Sample Photo 3');
  await expect(page.getByText('praline chits are touching', { exact: false })).toHaveCount(0);
  await review(page);

  await expect(count(page, 1)).toHaveAccessibleName(/^Chits of 1: 6\./);
  await expect(count(page, 5)).toHaveAccessibleName(/^Chits of 5: 0\./);
  await expect(count(page, 10)).toHaveAccessibleName(/^Chits of 10: 2\./);
  await expect(count(page, 20)).toHaveAccessibleName(/^Chits of 20: 0\./);
  await expect(page.getByTestId('pralines-held')).toHaveText('26 pralines');
  await expect(page.getByRole('switch', { name: /Special Tile/ })).toBeChecked();
  // 26 pralines + 7 for the special tile - 2 per empty space (one space is outlined to check).
  const empty = Number.parseInt((await page.getByTestId('empty-count').textContent()) ?? '', 10);
  await expect(page.getByTestId('running-total')).toHaveText(`${33 - 2 * empty} Points`);

  // The counts stay editable.
  await page.getByRole('button', { name: 'Decrease Chits of 10', exact: true }).click();
  await expect(page.getByTestId('running-total')).toHaveText(`${23 - 2 * empty} Points`);
});

test('overlapping chits are flagged with a warning to check the counts', async ({ page }) => {
  // A 1 chit lies on a 10 chit in this photo.
  await openSample(page, 'Try Sample Photo 2');
  await expect(
    page.getByText(
      'Some praline chits are touching or hidden. Check the counts, or spread them out and retake the photo.',
    ),
  ).toBeVisible();
  await review(page);
  await expect(count(page, 1)).toHaveClass(/outline-dashed/);
  await expect(count(page, 10)).toHaveClass(/outline-dashed/);
  await expect(
    page.getByRole('switch', { name: /Special Tile/ }).locator('xpath=..'),
  ).toHaveAttribute('data-low-confidence', 'true');
});
