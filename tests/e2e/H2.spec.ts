import { expect, test, type Page } from '@playwright/test';

const SCORE = '/games/harmonies/score';

/** Sample photo 1 (side A, pink table) through capture to the review screen. */
async function reviewSample(page: Page) {
  await page.goto(SCORE);
  await page.getByRole('button', { name: 'Try Sample Photo 1' }).click();
  await expect(page).toHaveURL(/\/score\/capture$/);
  // The first run compiles the worker and loads opencv in next dev.
  const read = page.getByRole('button', { name: 'Read Board' });
  await expect(read).toBeVisible({ timeout: 150_000 });
  await expect(page.getByText("Couldn't find the board edges")).toHaveCount(0);
  await read.click();
  await expect(page).toHaveURL(/\/score\/review$/, { timeout: 30_000 });
}

test('H2: a sample photo becomes a side A draft with top colors, then heights are set', async ({
  page,
}) => {
  test.setTimeout(240_000);
  await reviewSample(page);

  await expect(page.getByLabel('Board Side')).toHaveValue('A');
  await expect(page.locator('[data-cell]')).toHaveCount(23);
  // From data/fixtures/harmonies/labels.json: water at (0,3), a field at (0,4), a mountain under
  // a cube at (2,-1), and (0,0) empty.
  const cell = (key: string) => page.locator(`[data-cell="${key}"]`);
  await expect(cell('0,3')).toHaveAttribute('aria-label', 'Column 1, Space 4: water');
  await expect(cell('0,4')).toHaveAttribute('aria-label', 'Column 1, Space 5: field');
  await expect(cell('2,-1')).toHaveAttribute('aria-label', 'Column 3, Space 1: mountain, height 1');
  await expect(cell('0,0')).toHaveAttribute('aria-label', 'Column 1, Space 1: empty');

  // Heights are asked for mountains, trees, trunks and roofs, never water or fields.
  await expect(page.getByRole('heading', { name: 'Set Heights' })).toBeVisible();
  await expect(page.locator('[data-height-prompt="2,-1"]')).toBeVisible();
  await expect(page.locator('[data-height-prompt="0,3"]')).toHaveCount(0);
  await expect(page.locator('[data-height-prompt="0,4"]')).toHaveCount(0);
  await expect(page.getByRole('status').filter({ hasText: 'to check.' })).toBeVisible();

  const before = await page.getByTestId('running-total').textContent();
  const mountain = page.locator('[data-height-prompt="2,-1"]');
  await mountain.getByRole('button', { name: 'Column 3, Space 1: Mountain, Height 3' }).click();
  await expect(
    mountain.getByRole('button', { name: 'Column 3, Space 1: Mountain, Height 3' }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(cell('2,-1')).toHaveAttribute('aria-label', 'Column 3, Space 1: mountain, height 3');
  await expect(page.getByTestId('running-total')).not.toHaveText(before ?? '');

  await page.getByRole('link', { name: 'See Score' }).click();
  await expect(page).toHaveURL(/\/score\/result$/);
  await expect(page.getByText('Mountains', { exact: true })).toBeVisible();
});

test('H2: rereading the photo as side B keeps the cards', async ({ page }) => {
  test.setTimeout(240_000);
  await reviewSample(page);

  await page.getByRole('button', { name: 'Add Animal Card' }).click();
  await page.getByRole('button', { name: 'Increase Animal Card 1' }).click();

  await page.getByLabel('Board Side').selectOption('B');
  const sheet = page.getByRole('dialog', { name: 'Switch to Side B?' });
  await expect(sheet.getByRole('button', { name: 'Reread Photo as Side B' })).toBeVisible();
  await expect(sheet.getByRole('button', { name: 'Clear Board' })).toBeVisible();
  await sheet.getByRole('button', { name: 'Reread Photo as Side B' }).click();
  await expect(sheet).toBeHidden({ timeout: 30_000 });

  await expect(page.getByLabel('Board Side')).toHaveValue('B');
  await expect(page.locator('[data-cell]')).toHaveCount(25);
  // Read again, not cleared: some spaces have tokens.
  await expect(page.locator('[data-cell] circle').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Remove Animal Card 1' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Decrease Animal Card 1' })).toBeEnabled();
});
