import { randomUUID } from 'node:crypto';

import { expect, test, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const GAME = '/games/dorfromantik';
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

// Each worker gets its own user (see D-043), removed after.
const user = { id: '', email: '', password: `pw-${randomUUID()}` };

test.beforeAll(async () => {
  const { url, serviceKey } = supabaseEnv();
  user.email = `dorfromantik-d2-${randomUUID().slice(0, 8)}@local`;
  const { data, error } = await createClient(url, serviceKey, { auth }).auth.admin.createUser({
    email: user.email,
    password: user.password,
    email_confirm: true,
    user_metadata: { full_name: 'Campaign Player' },
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

async function setCount(page: Page, label: string, value: number): Promise<void> {
  await page
    .getByRole('button', { name: `${label}: 0. Hold to type a number.`, exact: true })
    .press('Enter');
  const input = page.getByRole('textbox', { name: label, exact: true });
  await input.fill(String(value));
  await input.press('Enter');
}

test('finish, rank and unlocks; hearts stop at 3; undo changes future sheets only', async ({
  page,
}) => {
  await signIn(page);

  // Game 1: 142 points.
  await page.goto(`${GAME}/score`);
  await expect(page.getByRole('heading', { name: 'Game 1' })).toBeVisible();
  await setCount(page, 'Forest', 100);
  await setCount(page, 'Longest Track', 42);
  await page.getByRole('button', { name: 'Finish Game' }).click();
  await expect(page.getByTestId('finish-total')).toHaveText('142 Points');
  await expect(page.getByTestId('finish-rank')).toHaveText('Actress');
  await expect(page.getByTestId('finish-circles')).toHaveText(
    'Cross off 4 circles on your campaign sheet.',
  );

  // Spoiler-safe picker: names only. Circus and 2 hearts.
  const picker = page.getByRole('region', { name: 'Any Unlocks?' });
  await expect(picker.getByRole('checkbox', { name: 'Flag Festival' })).toBeVisible();
  await expect(picker.getByText(/row to the scoresheet/)).toHaveCount(0);
  await picker.getByRole('checkbox', { name: 'Circus' }).click();
  await picker.getByRole('button', { name: 'Increase Red Hearts' }).click();
  await picker.getByRole('button', { name: 'Increase Red Hearts' }).click();
  await picker.getByRole('button', { name: 'Save Unlocks' }).click();
  await expect(page.getByRole('status')).toHaveText('Unlocked: Circus, 2 Red Hearts.');

  // Game 2 shows the new rows.
  await page.getByRole('link', { name: 'Score Next Game' }).click();
  await expect(page.getByRole('heading', { name: 'Game 2' })).toBeVisible();
  await expect(page.getByTestId('row-DOR-E-CIRCUS')).toBeVisible();
  await expect(page.getByTestId('row-DOR-E-REDHEARTS')).toBeVisible();
  await expect(page.getByTestId('locked-count')).toHaveText('13 rows still locked.');
  await page.getByRole('button', { name: 'Finish Game' }).click();
  await expect(page.getByTestId('finish-rank')).toHaveText('Vagabond');
  await expect(page.getByTestId('finish-circles')).toHaveText(
    'Cross off 1 circle on your campaign sheet.',
  );

  // Only one heart is left: the stepper stops there.
  await expect(picker.getByRole('checkbox', { name: 'Circus: already unlocked' })).toBeVisible();
  await expect(picker.getByText('2 of 3 unlocked. 1 left.')).toBeVisible();
  await picker.getByRole('button', { name: 'Increase Red Hearts' }).click();
  await expect(picker.getByRole('button', { name: 'Increase Red Hearts' })).toBeDisabled();
  await picker.getByRole('button', { name: 'Save Unlocks' }).click();
  await expect(page.getByRole('status')).toHaveText('Unlocked: 1 Red Heart.');

  // The campaign page.
  await page.getByRole('link', { name: 'See Campaign' }).click();
  await expect(page.getByTestId('games-played')).toHaveText('2');
  await expect(page.getByTestId('high-score')).toHaveText('142');
  await expect(page.getByTestId('rank-title')).toHaveText('Actress');
  await expect(page.getByTestId('red-hearts')).toHaveText('Red Hearts (3 of 3)');
  await expect(page.getByText('Adds the Circus row to the scoresheet.')).toBeVisible();

  // Undo Circus: future sheets lose the row; the saved game keeps its total.
  await page.getByRole('button', { name: 'Undo Circus from game 1' }).click();
  await page.getByRole('button', { name: 'Undo Unlock' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Undo Circus from game 1' })).toHaveCount(0);

  await page.goto(`${GAME}/score`);
  await expect(page.getByRole('heading', { name: 'Game 3' })).toBeVisible();
  await expect(page.getByTestId('row-DOR-E-REDHEARTS')).toBeVisible();
  await expect(page.getByTestId('row-DOR-E-CIRCUS')).toHaveCount(0);

  // A fourth heart is never offered.
  await page.getByRole('button', { name: 'Finish Game' }).click();
  await expect(
    picker.getByRole('checkbox', { name: 'Red Hearts: already unlocked' }),
  ).toBeVisible();
  await expect(picker.getByRole('button', { name: 'Increase Red Hearts' })).toHaveCount(0);
  await picker.getByRole('button', { name: 'No Unlocks' }).click();

  await page.goto(`${GAME}/history`);
  await expect(page.getByRole('link', { name: /142/ })).toBeVisible();

  // A new campaign archives this one: the next sheet is game 1 with nothing unlocked.
  await page.goto(`${GAME}/campaign`);
  await page.getByRole('button', { name: 'Start New Campaign' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Start New Campaign' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Score a Game' })).toBeVisible();

  await page.goto(`${GAME}/score`);
  await expect(page.getByRole('heading', { name: 'Game 1' })).toBeVisible();
  await expect(page.getByTestId('row-DOR-E-REDHEARTS')).toHaveCount(0);
  await expect(page.getByTestId('locked-count')).toHaveText('15 rows still locked.');

  // The archived campaign's games stay in history.
  await page.goto(`${GAME}/history`);
  await expect(page.getByRole('link', { name: /142/ })).toBeVisible();
});
