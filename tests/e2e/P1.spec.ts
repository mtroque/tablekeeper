import { randomUUID } from 'node:crypto';

import { expect, test, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const SCORE = '/games/patchwork/score';
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

// Like S1: S0's sign-out test ends every session of the shared seeded user, so this file
// signs in its own user, removed after.
const user = { id: '', email: '', password: `pw-${randomUUID()}` };

test.beforeAll(async () => {
  const { url, serviceKey } = supabaseEnv();
  user.email = `patchwork-e2e-${randomUUID().slice(0, 8)}@local`;
  const { data, error } = await createClient(url, serviceKey, { auth }).auth.admin.createUser({
    email: user.email,
    password: user.password,
    email_confirm: true,
  });
  if (error) throw error;
  user.id = data.user.id;
});

test.afterAll(async () => {
  const { url, serviceKey } = supabaseEnv();
  await createClient(url, serviceKey, { auth }).auth.admin.deleteUser(user.id);
});

async function signIn(page: Page): Promise<void> {
  const { url, anonKey } = supabaseEnv();
  const { data, error } = await createClient(url, anonKey, { auth }).auth.signInWithPassword({
    email: user.email,
    password: user.password,
  });
  if (error) throw error;
  await page.addInitScript(
    ([key, value]) => {
      if (!sessionStorage.getItem('tk:e2e-signed-in')) {
        localStorage.setItem(key, value);
        sessionStorage.setItem('tk:e2e-signed-in', '1');
      }
    },
    [AUTH_STORAGE_KEY, JSON.stringify(data.session)] as const,
  );
}

async function increase(page: Page, label: string, times: number) {
  for (let i = 0; i < times; i++) {
    await page.getByRole('button', { name: `Increase ${label}`, exact: true }).click();
  }
}

test("manual entry: the rulebook's Scoring example scores 11 and highlights the empty spaces", async ({
  page,
}) => {
  await signIn(page);
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
