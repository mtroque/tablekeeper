import { randomUUID } from 'node:crypto';

import { expect, test, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

import { createDb } from '../../apps/api/src/db/client';

const SCORE = '/games/dorfromantik/score';
/** Must match AUTH_STORAGE_KEY in apps/web/src/lib/supabase.ts. */
const AUTH_STORAGE_KEY = 'tk:auth';
const auth = { persistSession: false, autoRefreshToken: false };

function supabaseEnv() {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const databaseUrl = process.env.DATABASE_URL;
  if (!url || !anonKey || !serviceKey || !databaseUrl) {
    throw new Error('Test env missing; playwright.config.ts fills it.');
  }
  return { url, anonKey, serviceKey, databaseUrl };
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
  const { url, serviceKey, databaseUrl } = supabaseEnv();
  const db = createDb(databaseUrl);
  await db`delete from public.play_sessions where user_id = ${user.id}`;
  await db`delete from public.campaigns where user_id = ${user.id}`;
  await db`delete from public.profiles where id = ${user.id}`;
  await createClient(url, serviceKey, { auth }).auth.admin.deleteUser(user.id);
});

/** Signs the test user in and returns the serialized session. */
async function userSession(): Promise<string> {
  const { url, anonKey } = supabaseEnv();
  const client = createClient(url, anonKey, { auth });
  const { data, error } = await client.auth.signInWithPassword({
    email: user.email,
    password: user.password,
  });
  if (error) throw error;
  return JSON.stringify(data.session);
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
  const { databaseUrl } = supabaseEnv();
  const db = createDb(databaseUrl);
  const session = await userSession();
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
  await page.getByRole('button', { name: 'No Unlocks' }).click();

  await page.getByRole('link', { name: 'See Saved Game' }).click();
  await expect(page).toHaveURL(/\/games\/dorfromantik\/history\/[0-9a-f-]{36}$/);
  await expect(page.getByText('60 Points')).toBeVisible();

  await page.goto('/games/dorfromantik/history');
  await expect(page.getByRole('link', { name: /60/ }).first()).toBeVisible();

  // The campaign counts the game; the next sheet is game 2.
  const [stored] = await db<{ state: { games: unknown[]; unlocked: string[] } }>`
    select state
    from public.campaigns
    where user_id = ${user.id} and game_id = 'dorfromantik' and not archived
  `;
  expect(stored?.state.games).toHaveLength(1);

  await page.goto(SCORE);
  await expect(page.getByRole('heading', { name: 'Game 2' })).toBeVisible();

  // Unlocking Circus adds the Circus row.
  await db`
    update public.campaigns
    set state = ${db.json({ ...stored?.state, unlocked: ['DOR-U-CIRCUS'] })}
    where user_id = ${user.id} and game_id = 'dorfromantik' and not archived
  `;
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
  // Unlocks are D2's; this game has none.
  await page.getByRole('button', { name: 'No Unlocks' }).click();
  await expect(page.getByText('Saved to the campaign on this device.')).toBeVisible();
  await page.getByRole('link', { name: 'Score Next Game' }).click();
  await expect(page.getByRole('heading', { name: 'Game 2' })).toBeVisible();
});
