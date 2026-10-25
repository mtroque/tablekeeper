import { expect, test, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

import { signInAs } from './helpers';

const SCORE = '/games/harmonies/score';
const savedIds: string[] = [];

test.afterAll(async () => {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || savedIds.length === 0) return;
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  await db.from('play_sessions').delete().in('id', savedIds);
});

/** Opens a space's stack sheet and picks a stack by its name. */
async function setStack(page: Page, space: string, stack: string) {
  await page.getByRole('button', { name: new RegExp(`^${space}: `) }).click();
  const sheet = page.getByRole('dialog', { name: space });
  await sheet.getByRole('button', { name: stack, exact: true }).click();
  await expect(sheet).toBeHidden();
}

async function addCard(page: Page, item: string, points: number) {
  await page.getByRole('button', { name: `Add ${item}` }).click();
  const count = await page.getByRole('button', { name: new RegExp(`^Remove ${item} `) }).count();
  for (let i = 0; i < points; i++) {
    await page.getByRole('button', { name: `Increase ${item} ${count}` }).click();
  }
}

test('signed in: a board with cards scores by category, saves, and the saved game agrees', async ({
  page,
}) => {
  await signInAs(page, 'harmonies');
  await page.goto(SCORE);
  await page.getByRole('button', { name: 'Enter by Hand' }).click();
  await expect(page).toHaveURL(/\/score\/review$/);
  await expect(page.locator('[data-cell]')).toHaveCount(23);

  // The sheet offers Empty Space and the 14 valid stacks, nothing else.
  await page.getByRole('button', { name: 'Column 1, Space 1: empty' }).click();
  await expect(
    page.getByRole('dialog', { name: 'Column 1, Space 1' }).locator('[data-stack]'),
  ).toHaveCount(15);
  await page.getByRole('button', { name: 'Tree on 2 Trunks', exact: true }).click();
  await expect(page.getByTestId('running-total')).toHaveText('7 Points');

  // (2,1) and (2,2): mountains of height 2 and 1, next to each other.
  await setStack(page, 'Column 3, Space 3', 'Mountain, Height 2');
  await setStack(page, 'Column 3, Space 4', 'Mountain, Height 1');
  await expect(page.getByTestId('running-total')).toHaveText('11 Points');

  await addCard(page, 'Animal Card', 3);
  await addCard(page, 'Spirit Card', 2);
  await expect(page.getByTestId('running-total')).toHaveText('16 Points');

  await page.getByRole('button', { name: 'Show Labels' }).click();
  await expect(page.locator('[data-cell="0,0"] text')).toHaveText('TTL');

  await page.getByRole('link', { name: 'See Score' }).click();
  await expect(page.getByTestId('score-total')).toHaveText('16 Points');
  await expect(page.getByTestId('category-trees')).toHaveText('7');
  await expect(page.getByTestId('category-mountains')).toHaveText('4');
  await expect(page.getByTestId('category-animals')).toHaveText('3');
  await expect(page.getByTestId('category-spirits')).toHaveText('2');
  await page.getByRole('button', { name: /^Mountains/ }).click();
  await expect(page.locator('[data-highlighted]')).toHaveCount(2);

  await page.getByRole('button', { name: 'Save Game' }).click();
  await expect(page).toHaveURL(/\/games\/harmonies\/history\/[0-9a-f-]{36}$/);
  savedIds.push(new URL(page.url()).pathname.split('/').at(-1) ?? '');
  await expect(page.getByTestId('score-total')).toHaveText('16 Points');
  await expect(page.getByTestId('category-spirits')).toHaveText('2');
});

test('side switch: an empty board switches at once, a filled one offers only Clear Board or Cancel', async ({
  page,
}) => {
  await page.goto(SCORE);
  await page.getByRole('button', { name: 'Enter by Hand' }).click();
  const side = page.getByLabel('Board Side');

  await side.selectOption('B');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('[data-cell]')).toHaveCount(25);

  await setStack(page, 'Column 7, Space 1', 'Water');
  await addCard(page, 'Animal Card', 1);

  await side.selectOption('A');
  const sheet = page.getByRole('dialog', { name: 'Switch to Side A?' });
  await expect(sheet.getByRole('button')).toHaveText(['Clear Board', 'Cancel', 'Close']);
  await sheet.getByRole('button', { name: 'Cancel' }).click();
  await expect(side).toHaveValue('B');
  await expect(page.getByRole('button', { name: 'Column 7, Space 1: water' })).toBeVisible();

  await side.selectOption('A');
  await page.getByRole('button', { name: 'Clear Board' }).click();
  await expect(side).toHaveValue('A');
  await expect(page.locator('[data-cell]')).toHaveCount(23);
  await expect(page.locator('[data-cell] circle')).toHaveCount(0);
  // Cards don't depend on the side, so they stay.
  await expect(
    page.getByRole('button', { name: 'Animal Card 1: 1. Hold to type a number.' }),
  ).toBeVisible();
});
