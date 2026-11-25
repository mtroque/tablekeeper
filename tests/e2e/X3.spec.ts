import { expect, test } from '@playwright/test';

import { createDb } from '../../apps/api/src/db/client';

import {
  createTestUser,
  deleteTestUsers,
  signInWithSession,
  signTestSession,
  type E2eUser,
} from './helpers';

let user: E2eUser;

test.beforeAll(async () => {
  user = await createTestUser('x3-e2e', 'Neon Player');
});

test.afterAll(async () => {
  await deleteTestUsers([user]);
});

test('a signed-in user’s first request creates their profile, and saving a play and a campaign works end to end', async ({
  page,
}) => {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL missing; playwright.config.ts fills it.');
  const db = createDb(databaseUrl);

  // No sign-up trigger: before the first authenticated API request, no profile row exists.
  expect(await db`select id from public.profiles where id = ${user.id}`).toEqual([]);

  await signInWithSession(page, await signTestSession(user));
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
