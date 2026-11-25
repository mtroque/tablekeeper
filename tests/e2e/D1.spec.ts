import { expect, test, type Page } from '@playwright/test';

import { createDb } from '../../apps/api/src/db/client';

import {
  createTestUser,
  deleteTestUsers,
  signInWithSession,
  signTestSession,
  type E2eUser,
} from './helpers';

const SCORE = '/games/dorfromantik/score';

// Each worker gets its own user (see D-043), removed after.
let user: E2eUser;

test.beforeAll(async () => {
  user = await createTestUser('dorfromantik-e2e', 'Dorfromantik Player');
});

test.afterAll(async () => {
  await deleteTestUsers([user]);
});

/** Types a number into a counter's field. */
async function setCount(page: Page, label: string, value: number): Promise<void> {
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
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL missing; playwright.config.ts fills it.');
  const db = createDb(databaseUrl);
  await signInWithSession(page, await signTestSession(user));
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
