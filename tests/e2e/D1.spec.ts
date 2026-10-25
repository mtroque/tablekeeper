import { randomUUID } from 'node:crypto';

import { expect, test, type Page } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SCORE = '/games/dorfromantik/score';
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
  user.email = `dorfromantik-e2e-${randomUUID().slice(0, 8)}@local`;
  const { data, error } = await createClient(url, serviceKey, { auth }).auth.admin.createUser({
    email: user.email,
    password: user.password,
    email_confirm: true,
    user_metadata: { full_name: 'Dorfromantik Player' },
  });
  if (error) throw error;
  user.id = data.user.id;
});

test.afterAll(async () => {
  const { url, serviceKey } = supabaseEnv();
  await createClient(url, serviceKey, { auth }).auth.admin.deleteUser(user.id);
});

/** The user's own Supabase client and session, as the browser stores it. */
async function userClient(): Promise<{ db: SupabaseClient; session: string }> {
  const { url, anonKey } = supabaseEnv();
  const db = createClient(url, anonKey, { auth });
  const { data, error } = await db.auth.signInWithPassword({
    email: user.email,
    password: user.password,
  });
  if (error) throw error;
  return { db, session: JSON.stringify(data.session) };
}

async function signIn(page: Page, session: string): Promise<void> {
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

/** Types a number into a counter (Enter on the value switches it to typing). */
async function setCount(page: Page, label: string, value: number): Promise<void> {
  await page
    .getByRole('button', { name: `${label}: 0. Hold to type a number.`, exact: true })
    .press('Enter');
  const input = page.getByRole('textbox', { name: label, exact: true });
  await input.fill(String(value));
  await input.press('Enter');
}

/** The rulebook example (docs/games/dorfromantik.md → Worked examples): 60 points. */
async function fillRulebookExample(page: Page): Promise<void> {
  await setCount(page, 'Forest', 10);
  await setCount(page, 'Grain', 6);
  await setCount(page, 'Village', 12);
  await setCount(page, 'Track', 4);
  await setCount(page, 'Stream', 10);
  await setCount(page, 'Yellow Flags', 5);
  await setCount(page, 'Longest Track', 8);
  await setCount(page, 'Longest Stream', 5);
}

test('signed in: fill the sheet, finish, see it in history, and the campaign moves on', async ({
  page,
}) => {
  const { db, session } = await userClient();
  await signIn(page, session);
  await page.goto(SCORE);

  await expect(page.getByRole('heading', { name: 'Game 1' })).toBeVisible();
  await expect(page.getByTestId('locked-count')).toHaveText('15 rows still locked.');
  await expect(page.getByTestId('row-DOR-E-CIRCUS')).toHaveCount(0);

  await fillRulebookExample(page);
  await expect(page.getByTestId('subtotal-Tasks')).toContainText('42');
  await expect(page.getByTestId('subtotal-Flags and Longest')).toContainText('18');
  await expect(page.getByTestId('sheet-total')).toHaveText('60');

  // A refresh keeps the sheet.
  await page.reload();
  await expect(page.getByTestId('sheet-total')).toHaveText('60');

  await page.getByRole('button', { name: 'Finish Game' }).click();
  await expect(page).toHaveURL(`${SCORE}/finish`);
  await expect(page.getByTestId('finish-total')).toHaveText('60 Points');

  await page.getByRole('link', { name: 'See Saved Game' }).click();
  await expect(page).toHaveURL(/\/games\/dorfromantik\/history\/[0-9a-f-]{36}$/);
  await expect(page.getByText('60 Points')).toBeVisible();

  await page.goto('/games/dorfromantik/history');
  await expect(page.getByRole('link', { name: /60/ }).first()).toBeVisible();

  // The campaign counts the game; the next sheet is game 2.
  const stored = await db.from('campaigns').select('state').eq('game_id', 'dorfromantik').single();
  expect(stored.error).toBeNull();
  const state = stored.data?.state as { games: unknown[]; unlocked: string[] };
  expect(state.games).toHaveLength(1);

  await page.goto(SCORE);
  await expect(page.getByRole('heading', { name: 'Game 2' })).toBeVisible();

  // Unlocking Circus adds the Circus row.
  const updated = await db
    .from('campaigns')
    .update({ state: { ...state, unlocked: ['DOR-U-CIRCUS'] } })
    .eq('game_id', 'dorfromantik')
    .eq('archived', false);
  expect(updated.error).toBeNull();
  await page.reload();
  await expect(page.getByTestId('row-DOR-E-CIRCUS')).toBeVisible();
  await expect(page.getByTestId('locked-count')).toHaveText('14 rows still locked.');
  await page.getByRole('switch', { name: 'Circus: Completely surrounded' }).click();
  await expect(page.getByTestId('sheet-total')).toHaveText('10');
});

test('guest: the campaign is kept on this device', async ({ page }) => {
  await page.goto(SCORE);
  await expect(page.getByRole('heading', { name: 'Game 1' })).toBeVisible();
  await setCount(page, 'Forest', 4);
  await page.getByRole('button', { name: 'Finish Game' }).click();
  await expect(page.getByTestId('finish-total')).toHaveText('4 Points');
  await expect(page.getByText('Saved to the campaign on this device.')).toBeVisible();
  await page.getByRole('link', { name: 'Score Next Game' }).click();
  await expect(page.getByRole('heading', { name: 'Game 2' })).toBeVisible();
});
