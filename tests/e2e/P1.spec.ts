import { expect, test, type Page } from '@playwright/test';

import {
  createTestUser,
  deleteTestUsers,
  signInWithSession,
  signTestSession,
  type E2eUser,
} from './helpers';

const SCORE = '/games/patchwork/score';

// Each worker gets its own user, removed after (D-043).
let user: E2eUser;

test.beforeAll(async () => {
  user = await createTestUser('patchwork-e2e', 'Patchwork Player');
});

test.afterAll(async () => {
  await deleteTestUsers([user]);
});

async function increase(page: Page, label: string, times: number) {
  for (let i = 0; i < times; i++) {
    await page.getByRole('button', { name: `Increase ${label}`, exact: true }).click();
  }
}

test("manual entry: the rulebook's Scoring example scores 11 and highlights the empty spaces", async ({
  page,
}) => {
  await signInWithSession(page, await signTestSession(user));
  await page.goto(SCORE);
  await page.getByRole('button', { name: 'Enter by Hand' }).click();
  await expect(page).toHaveURL(/\/score\/review$/);
  // An empty red box board: 81 empty spaces.
  await expect(page.getByTestId('running-total')).toHaveText('-162 Points');
  await expect(page.getByRole('button', { name: 'Red', pressed: true })).toBeVisible();

  await page.getByRole('button', { name: 'Gray' }).click();
  await expect(page.getByRole('button', { name: 'Gray', pressed: true })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Gray Box Board' })).toBeVisible();

  await page.getByRole('button', { name: 'All Covered' }).click();
  await expect(page.getByTestId('empty-count')).toHaveText('0 empty spaces');
  await expect(page.getByTestId('running-total')).toHaveText('0 Points');
  const empty: Array<[number, number]> = [
    [1, 1],
    [1, 9],
    [5, 5],
    [9, 1],
    [9, 9],
  ];
  for (const [row, col] of empty) {
    await page.getByRole('button', { name: `Row ${row}, column ${col}: covered` }).click();
  }
  await expect(page.getByTestId('empty-count')).toHaveText('5 empty spaces');

  await increase(page, 'Chits of 1', 4);
  await increase(page, 'Chits of 10', 1);
  await expect(page.getByTestId('pralines-held')).toHaveText('14 pralines');
  // The box holds a single 20 chit.
  await increase(page, 'Chits of 20', 1);
  await expect(page.getByRole('button', { name: 'Increase Chits of 20' })).toBeDisabled();
  await page.getByRole('button', { name: 'Decrease Chits of 20' }).click();

  await page.getByRole('switch', { name: /Special Tile/ }).click();
  await expect(page.getByRole('switch', { name: /Special Tile/ })).toBeChecked();
  await expect(page.getByTestId('running-total')).toHaveText('11 Points');

  await page.getByRole('link', { name: 'See Score' }).click();
  await expect(page.getByTestId('score-total')).toHaveText('11 Points');
  await expect(page.getByTestId('category-pralines')).toHaveText('14');
  await expect(page.getByTestId('category-specialTile')).toHaveText('7');
  await expect(page.getByTestId('category-emptySpaces')).toHaveText('-10');
  await page.getByRole('button', { name: /Empty Spaces/ }).click();
  const lit = page.locator('[data-highlighted]');
  await expect(lit).toHaveCount(5);
  await expect(page.getByRole('img', { name: 'Gray box board with 5 empty spaces' })).toBeVisible();

  await page.getByRole('button', { name: 'Save Game' }).click();
  await expect(page).toHaveURL(/\/games\/patchwork\/history\/[0-9a-f-]{36}$/);
  await expect(page.getByTestId('score-total')).toHaveText('11 Points');
  await expect(page.getByTestId('category-emptySpaces')).toHaveText('-10');
});

test('All Empty clears the board and the board color stays when switching', async ({ page }) => {
  await page.goto(SCORE);
  await page.getByRole('button', { name: 'Enter by Hand' }).click();
  await page.getByRole('button', { name: 'All Covered' }).click();
  await page.getByRole('button', { name: 'Row 3, column 4: covered' }).click();
  await page.getByRole('button', { name: 'Gray' }).click();
  // Switching boards keeps the spaces.
  await expect(page.getByTestId('empty-count')).toHaveText('1 empty space');
  await page.getByRole('button', { name: 'All Empty' }).click();
  await expect(page.getByTestId('empty-count')).toHaveText('81 empty spaces');
  await expect(page.getByTestId('running-total')).toHaveText('-162 Points');
});
