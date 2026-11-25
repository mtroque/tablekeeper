import { expect, test, type Page } from '@playwright/test';

import {
  AUTH_STORAGE_KEY,
  createTestUser,
  deleteTestUsers,
  signInWithSession,
  signTestSession,
  type E2eUser,
} from './helpers';

const SCORE = '/games/_example/score';

// Each worker gets its own S1 user, removed after (D-043).
let user: E2eUser;

test.beforeAll(async () => {
  user = await createTestUser('s1-e2e', 'S1 Player');
});

test.afterAll(async () => {
  await deleteTestUsers([user]);
});

/** Covers the given cells of the example board on the review screen. */
async function cover(page: Page, cells: Array<[number, number]>) {
  for (const [row, col] of cells) {
    await page.getByRole('button', { name: `Row ${row}, column ${col}: empty` }).click();
  }
}

test('signed in: manual entry, review survives a refresh, save, history and detail agree', async ({
  page,
}) => {
  await signInWithSession(page, await signTestSession(user));
  await page.goto(SCORE);
  await page.getByRole('button', { name: 'Enter by Hand' }).click();
  await expect(page).toHaveURL(/\/score\/review$/);
  await cover(page, [
    [1, 1],
    [2, 2],
    [3, 3],
  ]);
  await expect(page.getByTestId('running-total')).toHaveText('3 Points');
  // A manual board has no low-confidence values, so no banner.
  await expect(page.getByText(/to check\./)).toHaveCount(0);

  await page.reload();
  await expect(page.getByTestId('running-total')).toHaveText('3 Points');
  await expect(page.getByRole('button', { name: 'Row 2, column 2: covered' })).toBeVisible();

  await page.getByRole('link', { name: 'See Score' }).click();
  await expect(page.getByTestId('score-total')).toHaveText('3 Points');
  await page.getByRole('button', { name: 'Covered Cells' }).click();
  await expect(page.locator('[data-highlighted]')).toHaveCount(3);

  await page.getByRole('button', { name: 'Save Game' }).click();
  await expect(page).toHaveURL(/\/games\/_example\/history\/[0-9a-f-]{36}$/);
  const detailPath = new URL(page.url()).pathname;
  await expect(page.getByTestId('score-total')).toHaveText('3 Points');
  await expect(page.getByTestId('category-covered')).toHaveText('3');

  await page.getByRole('link', { name: 'All Games' }).click();
  // Another test in this worker may have saved too, so find this game by its link.
  const saved = page.locator(`[data-testid="history-item"][href="${detailPath}"]`);
  await expect(saved).toContainText('3 Points');
  await expect(page.getByTestId('personal-best')).toBeVisible();
  await saved.click();
  await expect(page).toHaveURL(new RegExp(`${detailPath}$`));
  await expect(page.getByTestId('score-total')).toHaveText('3 Points');
});

test("guest: Don't Save stores nothing", async ({ page }) => {
  await page.goto(SCORE);
  await page.getByRole('button', { name: 'Enter by Hand' }).click();
  await cover(page, [[1, 1]]);
  await page.getByRole('link', { name: 'See Score' }).click();
  await expect(page.getByRole('button', { name: 'Sign In with Google' })).toBeVisible();
  await page.getByRole('button', { name: "Don't Save" }).click();
  await expect(page).toHaveURL(new RegExp(`${SCORE}$`));
  await expect(page.getByRole('button', { name: 'Enter by Hand' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Continue Review' })).toHaveCount(0);
  const stored = await page.evaluate(() => [
    ...Object.keys(localStorage).filter((k) => k.startsWith('tk:v1:')),
    ...Object.keys(sessionStorage).filter((k) => k.startsWith('tk:v1:')),
  ]);
  expect(stored).toEqual([]);
  await page.goto('/games/_example/history');
  await expect(page.getByRole('button', { name: 'Sign In with Google' })).toBeVisible();
});

test('guest: Sign In with Google saves the result on return without re-entry', async ({ page }) => {
  // Real Google sign-in isn't used in tests: stop at Neon Auth's social sign-in call, then come
  // back to the callback signed in, as the OAuth redirect would.
  await page.route('**/sign-in/social**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        url: 'https://accounts.google.com/o/oauth2/v2/auth',
        redirect: false,
      }),
    }),
  );
  await page.goto(SCORE);
  await page.getByRole('button', { name: 'Enter by Hand' }).click();
  await cover(page, [
    [1, 1],
    [1, 2],
    [3, 1],
    [3, 3],
  ]);
  await page.getByRole('link', { name: 'See Score' }).click();
  await expect(page.getByTestId('score-total')).toHaveText('4 Points');
  const authorize = page.waitForRequest('**/sign-in/social**');
  await page.getByRole('button', { name: 'Sign In with Google' }).click();
  await authorize;

  const session = await signTestSession(user);
  await page.goto('/');
  await page.evaluate(
    ([key, value]) => {
      localStorage.setItem(key, value);
    },
    [AUTH_STORAGE_KEY, session] as const,
  );
  await page.goto('/auth/callback');
  await expect(page).toHaveURL(/\/games\/_example\/history\/[0-9a-f-]{36}$/);
  await expect(page.getByTestId('score-total')).toHaveText('4 Points');
});

test('a photo goes to corner adjustment, and manual entry is always offered', async ({ page }) => {
  await page.goto(SCORE);
  // No sample photos for the example game, so no sample button.
  await expect(page.getByRole('button', { name: /Try Sample Photo/ })).toHaveCount(0);
  await page
    .getByTestId('photo-upload')
    .setInputFiles('data/fixtures/patchwork/references/empty-red-1.jpg');
  await expect(page).toHaveURL(/\/score\/capture$/);
  await expect(page.getByRole('img', { name: 'Your board photo' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Top left corner/ })).toBeVisible();
  // Until S2's detector lands, reading is unavailable; after it, the corners are ready to read.
  await expect(
    page
      .getByText("Photo reading isn't available yet.")
      .or(page.getByRole('button', { name: 'Read Board' })),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Enter by Hand' }).click();
  await expect(page).toHaveURL(/\/score\/review$/);
  await expect(page.getByTestId('running-total')).toHaveText('0 Points');
});

test('square and hex editors report taps as cell refs and work by keyboard', async ({ page }) => {
  await page.goto(`${SCORE}/editor-check`);
  const last = page.getByTestId('last-tap');

  await page.getByRole('button', { name: 'Square row 1, column 1' }).click();
  await expect(last).toHaveText('Last tap: square 0,0');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('button', { name: 'Square row 2, column 2' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(last).toHaveText('Last tap: square 1,1');
  await expect(page.getByRole('button', { name: 'Square row 2, column 2' })).toHaveAttribute(
    'data-low-confidence',
    'true',
  );

  await page.getByRole('button', { name: 'Hex 2,-1' }).click();
  await expect(last).toHaveText('Last tap: hex 2,-1');
  await page.getByRole('button', { name: 'Hex 0,0' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('button', { name: 'Hex 1,0' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(last).toHaveText('Last tap: hex 1,0');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press(' ');
  await expect(last).toHaveText('Last tap: hex 1,1');
  await expect(page.getByRole('button', { name: 'Hex 1,0' })).toHaveAttribute(
    'data-low-confidence',
    'true',
  );
});

test('signed in: the campaign page saves through the account', async ({ page }) => {
  await signInWithSession(page, await signTestSession(user));
  await page.goto('/games/_example/campaign');
  const value = page.getByRole('textbox', { name: 'Games Played', exact: true });
  await expect(value).toHaveValue(/^\d+$/);
  const before = Number(await value.inputValue());
  await page.getByRole('button', { name: 'Increase Games Played' }).click();
  await page.getByRole('button', { name: 'Save Campaign' }).click();
  await expect(page.getByRole('button', { name: 'Save Campaign' })).toBeDisabled();
  await page.reload();
  await expect(value).toHaveValue(String(before + 1));
});
