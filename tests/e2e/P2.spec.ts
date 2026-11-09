import { expect, test, type Page } from '@playwright/test';

const SCORE = '/games/patchwork/score';

/** Opens a sample photo, waits for the corners, reads the board and lands on review. */
async function readSample(page: Page, name: string): Promise<void> {
  await page.goto(SCORE);
  await page.getByRole('button', { name }).click();
  await expect(page).toHaveURL(/\/score\/capture$/);
  // The first read loads opencv in the worker; give it time.
  const read = page.getByRole('button', { name: 'Read Board' });
  await expect(read).toBeVisible({ timeout: 60_000 });
  await read.click();
  await expect(page).toHaveURL(/\/score\/review$/, { timeout: 30_000 });
}

const grid = (page: Page) => page.getByRole('group', { name: /Box Board$/ });

test('a red board photo becomes a draft with every space read', async ({ page }) => {
  await readSample(page, 'Try Sample Photo 1');
  await expect(page.getByRole('button', { name: 'Red', pressed: true })).toBeVisible();
  await expect(page.getByTestId('empty-count')).toHaveText('14 empty spaces');
  // No chits are read yet (P3), so the score is the empty spaces alone.
  await expect(page.getByTestId('running-total')).toHaveText('-28 Points');
  await expect(page.getByText(/to check\.$/)).toHaveCount(0);
  await expect(grid(page).locator('[data-low-confidence]')).toHaveCount(0);

  // The draft stays editable: covering a space updates the total.
  await page.getByRole('button', { name: 'Row 1, column 1: empty' }).click();
  await expect(page.getByTestId('empty-count')).toHaveText('13 empty spaces');
  await expect(page.getByTestId('running-total')).toHaveText('-26 Points');
});

test('glare on a gray board photo is outlined for review', async ({ page }) => {
  await page.goto(SCORE);
  await page.getByRole('button', { name: 'Try Sample Photo 2' }).click();
  await expect(page).toHaveURL(/\/score\/capture$/);
  await expect(page.getByText('4 spaces have glare.', { exact: false })).toBeVisible({
    timeout: 60_000,
  });
  await page.getByRole('button', { name: 'Read Board' }).click();
  await expect(page).toHaveURL(/\/score\/review$/, { timeout: 30_000 });

  await expect(page.getByRole('button', { name: 'Gray', pressed: true })).toBeVisible();
  await expect(page.getByTestId('empty-count')).toHaveText('18 empty spaces');
  await expect(page.getByRole('status').filter({ hasText: '4 values to check.' })).toBeVisible();
  const uncertain = grid(page).locator('[data-low-confidence]');
  await expect(uncertain).toHaveCount(4);
  await expect(uncertain.first()).toHaveAccessibleName('Row 1, column 1: empty');
});
