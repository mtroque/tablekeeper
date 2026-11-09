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
  // The chits beside the board are read too (P3): 2 chits of 1 and 3 of 5.
  await expect(page.getByTestId('pralines-held')).toHaveText('17 pralines');
  await expect(page.getByTestId('running-total')).toHaveText('-11 Points');
  await expect(grid(page).locator('[data-low-confidence]')).toHaveCount(0);

  // The draft stays editable: covering a space updates the total.
  await page.getByRole('button', { name: 'Row 1, column 1: empty' }).click();
  await expect(page.getByTestId('empty-count')).toHaveText('13 empty spaces');
  await expect(page.getByTestId('running-total')).toHaveText('-9 Points');
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
  // The 4 glare spaces, and the 5 chit values, since a 1 chit lies on a 10 chit in this photo.
  await expect(page.getByRole('status').filter({ hasText: '9 values to check.' })).toBeVisible();
  const uncertain = grid(page).locator('[data-low-confidence]');
  await expect(uncertain).toHaveCount(4);
  await expect(uncertain.first()).toHaveAccessibleName('Row 1, column 1: empty');
});

test('switching the board rereads the photo and keeps the chits and special tile', async ({
  page,
}) => {
  await readSample(page, 'Try Sample Photo 1');
  await expect(page.getByTestId('empty-count')).toHaveText('14 empty spaces');
  await page.getByRole('button', { name: 'Increase Chits of 5', exact: true }).click();
  await page.getByRole('switch', { name: /Special Tile/ }).click();

  // Read against the gray board's references, the red board's spaces come out differently.
  await page.getByRole('button', { name: 'Gray', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Gray', pressed: true })).toBeVisible();
  await expect(page.getByTestId('empty-count')).not.toHaveText('14 empty spaces');
  await expect(page.getByTestId('pralines-held')).toHaveText('22 pralines');
  await expect(page.getByRole('switch', { name: /Special Tile/ })).toBeChecked();
  // The player chose the board, so the switch isn't outlined.
  await expect(
    page.getByRole('group', { name: 'Box Board Color' }).locator('xpath=..'),
  ).not.toHaveAttribute('data-low-confidence');

  // Back to red: the original reading returns, and the chits and tile stay.
  await page.getByRole('button', { name: 'Red', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Red', pressed: true })).toBeVisible();
  await expect(page.getByTestId('empty-count')).toHaveText('14 empty spaces');
  await expect(page.getByTestId('pralines-held')).toHaveText('22 pralines');
  await expect(page.getByTestId('running-total')).toHaveText('1 Point');
});

test('a failed reread keeps the new color and asks the player to check the spaces', async ({
  page,
}) => {
  // Every reading sent with a hint (only rereads have one) fails after a moment, as if the
  // worker had crashed.
  await page.addInitScript(() => {
    const RealWorker = window.Worker;
    window.Worker = class extends RealWorker {
      override postMessage(message: unknown, transfer?: unknown): void {
        const request = message as { type?: string; id?: number; hints?: unknown };
        if (request.type === 'detect' && request.hints) {
          const data = { type: 'result', id: request.id, result: { ok: false, error: 'failed' } };
          setTimeout(() => {
            this.onmessage?.(new MessageEvent('message', { data }));
          }, 800);
          return;
        }
        super.postMessage(message, transfer as Transferable[]);
      }
    };
  });
  await readSample(page, 'Try Sample Photo 1');
  await page.getByRole('button', { name: 'Gray', exact: true }).click();
  // While it reads, the board can't be changed, so no tap is lost.
  await expect(page.getByRole('status').filter({ hasText: 'Reading the spaces.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Row 1, column 1: empty' })).toBeDisabled();
  await expect(
    page.getByRole('alert').filter({ hasText: "Couldn't reread the photo. Check the spaces." }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Gray', pressed: true })).toBeVisible();
  await expect(page.getByTestId('empty-count')).toHaveText('14 empty spaces');
  await expect(page.getByRole('button', { name: 'Row 1, column 1: empty' })).toBeEnabled();
});
