import { randomUUID } from 'node:crypto';

import { expect, test, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

import { createDb } from '../../apps/api/src/db/client';

/** Must match AUTH_STORAGE_KEY in apps/web/src/lib/supabase.ts. */
const AUTH_STORAGE_KEY = 'tk:auth';
const auth = { persistSession: false, autoRefreshToken: false };

function testEnv() {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const databaseUrl = process.env.DATABASE_URL;
  if (!url || !anonKey || !serviceKey || !databaseUrl) {
    throw new Error('Test env missing; playwright.config.ts fills it.');
  }
  return { url, anonKey, serviceKey, databaseUrl };
}

const user = { id: '', email: '', password: `pw-${randomUUID()}` };

test.beforeAll(async () => {
  const { url, serviceKey } = testEnv();
  user.email = `x3-e2e-${randomUUID().slice(0, 8)}@local`;
  const { data, error } = await createClient(url, serviceKey, { auth }).auth.admin.createUser({
    email: user.email,
    password: user.password,
    email_confirm: true,
    user_metadata: { full_name: 'Neon Player' },
  });
  if (error) throw error;
  user.id = data.user.id;
});

test.afterAll(async () => {
  const { url, serviceKey, databaseUrl } = testEnv();
  const db = createDb(databaseUrl);
  await db`delete from public.play_sessions where user_id = ${user.id}`;
  await db`delete from public.campaigns where user_id = ${user.id}`;
  await db`delete from public.profiles where id = ${user.id}`;
  await createClient(url, serviceKey, { auth }).auth.admin.deleteUser(user.id);
});

async function signIn(page: Page): Promise<void> {
  const { url, anonKey } = testEnv();
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

test('a signed-in user’s first request creates their profile, and saving a play and a campaign works end to end', async ({
  page,
}) => {
  const { databaseUrl } = testEnv();
  const db = createDb(databaseUrl);

  // No sign-up trigger: before the first authenticated API request, no profile row exists.
  expect(await db`select id from public.profiles where id = ${user.id}`).toEqual([]);

  await signIn(page);
  await page.goto('/');

  // The header calls GET /v1/me, which creates the profile row on first authenticated request.
  const avatar = page.getByRole('button', { name: 'Account: Neon Player' });
  await expect(avatar).toBeVisible();
  await avatar.click();
  await expect(page.getByTestId('account-name')).toHaveText('Neon Player');
  expect(
    await db<{ id: string; display_name: string }>`
      select id, display_name from public.profiles where id = ${user.id}
    `,
  ).toEqual([{ id: user.id, display_name: 'Neon Player' }]);

  // Save a play and a campaign end to end through the Dorfromantik scoresheet.
  await page.goto('/games/dorfromantik/score');
  await expect(page.getByRole('heading', { name: 'Game 1' })).toBeVisible();
  await page
    .getByRole('button', { name: 'Forest: 0. Hold to type a number.', exact: true })
    .press('Enter');
  const input = page.getByRole('textbox', { name: 'Forest', exact: true });
  await input.fill('24');
  await input.press('Enter');

  await page.getByRole('button', { name: 'Finish Game' }).click();
  await expect(page.getByTestId('finish-total')).toHaveText('24 Points');
  await page
    .getByRole('region', { name: 'Any Unlocks?' })
    .getByRole('checkbox', { name: 'Circus' })
    .click();
  await page.getByRole('button', { name: 'Save Unlocks' }).click();
  await expect(page.getByRole('status')).toHaveText('Unlocked: Circus.');

  await page.getByRole('link', { name: 'See Saved Game' }).click();
  await expect(page).toHaveURL(/\/games\/dorfromantik\/history\/[0-9a-f-]{36}$/);
  await expect(page.getByText('24 Points')).toBeVisible();

  await page.goto('/games/dorfromantik/campaign');
  await expect(page.getByTestId('games-played')).toHaveText('1');
  await expect(page.getByTestId('high-score')).toHaveText('24');
  await expect(page.getByText('Adds the Circus row to the scoresheet.')).toBeVisible();
});
