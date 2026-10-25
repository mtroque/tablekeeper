import { randomUUID } from 'node:crypto';

import { expect, test, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const SCORE = '/games/_example/score';
/** Must match AUTH_STORAGE_KEY in apps/web/src/lib/supabase.ts. */
const AUTH_STORAGE_KEY = 'tk:auth';
const auth = { persistSession: false, autoRefreshToken: false };

function supabaseEnv() {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceKey) {
    throw new Error('Supabase env missing; playwright.config.ts fills it.');
  }
  return { url, anonKey, serviceKey };
}

// S0's e2e test signs the shared seeded user out everywhere, which ends any session of that
// user mid-test when files run in parallel. So each worker gets its own S1 user, removed after.
const user = { id: '', email: '', password: `pw-${randomUUID()}` };

test.beforeAll(async () => {
  const { url, serviceKey } = supabaseEnv();
  user.email = `s1-e2e-${randomUUID().slice(0, 8)}@local`;
  const { data, error } = await createClient(url, serviceKey, { auth }).auth.admin.createUser({
    email: user.email,
    password: user.password,
    email_confirm: true,
    user_metadata: { full_name: 'S1 Player' },
  });
  if (error) throw error;
  user.id = data.user.id;
});

test.afterAll(async () => {
  const { url, serviceKey } = supabaseEnv();
  await createClient(url, serviceKey, { auth }).auth.admin.deleteUser(user.id);
});

/** A fresh session for the S1 user, as the browser's Supabase client stores it. */
async function userSession(): Promise<string> {
  const { url, anonKey } = supabaseEnv();
  const { data, error } = await createClient(url, anonKey, { auth }).auth.signInWithPassword({
    email: user.email,
    password: user.password,
  });
  if (error) throw error;
  return JSON.stringify(data.session);
}

/** Starts the page signed in (once per tab, like the shared `signInAs`). */
async function signIn(page: Page): Promise<void> {
  const session = await userSession();
  await page.addInitScript(
    ([key, value]) => {
      if (!sessionStorage.getItem('tk:e2e-signed-in')) {
        localStorage.setItem(key, value);
        sessionStorage.setItem('tk:e2e-signed-in', '1');
      }
    },
    [AUTH_STORAGE_KEY, session] as const,
  );
}

/** Covers the given cells of the example board on the review screen. */
async function cover(page: Page, cells: Array<[number, number]>) {
  for (const [row, col] of cells) {
    await page.getByRole('button', { name: `Row ${row}, column ${col}: empty` }).click();
  }
}

test('signed in: manual entry, review survives a refresh, save, history and detail agree', async ({
  page,
}) => {
  await signIn(page);
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
  // Real Google sign-in isn't used in tests: stop at Supabase's authorize step, then come
  // back to the callback signed in, as the OAuth redirect would.
  await page.route('**/auth/v1/authorize**', (route) => route.abort());
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
  const authorize = page.waitForRequest('**/auth/v1/authorize**');
  await page.getByRole('button', { name: 'Sign In with Google' }).click();
  await authorize;

  const session = await userSession();
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
  await signIn(page);
  await page.goto('/games/_example/campaign');
  const value = page.getByRole('button', { name: /^Games Played: \d+\./ });
  await expect(value).toBeVisible();
  const before = Number(/: (\d+)\./.exec((await value.getAttribute('aria-label')) ?? '')?.[1]);
  await page.getByRole('button', { name: 'Increase Games Played' }).click();
  await page.getByRole('button', { name: 'Save Campaign' }).click();
  await expect(page.getByRole('button', { name: 'Save Campaign' })).toBeDisabled();
  await page.reload();
  await expect(
    page.getByRole('button', { name: `Games Played: ${before + 1}. Hold to type a number.` }),
  ).toBeVisible();
});
