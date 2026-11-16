import { expect, test, type Browser, type Page } from '@playwright/test';

import {
  AUTH_STORAGE_KEY,
  createTestUser,
  deleteTestUsers,
  signTestSession,
  type E2eUser,
} from './helpers';

const SCORE = '/games/azul/score';

// Its own user (as S1 does), so S0's sign-out-everywhere test can't end this one's sessions.
let user: E2eUser;

test.beforeAll(async () => {
  user = await createTestUser('azul-e2e', 'Azul Player');
});

test.afterAll(async () => {
  await deleteTestUsers([user]);
});

/** A new browser context ("another device") signed in as the Azul user. */
async function signedInDevice(browser: Browser): Promise<Page> {
  const session = await signTestSession(user);
  const context = await browser.newContext();
  await context.addInitScript(
    ([key, value]) => {
      if (!sessionStorage.getItem('tk:e2e-signed-in')) {
        localStorage.setItem(key, value);
        sessionStorage.setItem('tk:e2e-signed-in', '1');
      }
    },
    [AUTH_STORAGE_KEY, session] as const,
  );
  return context.newPage();
}

/** Taps a chocolate box space by its 1-based row and column. */
async function tapSpace(page: Page, row: number, col: number) {
  await page.getByRole('button', { name: new RegExp(`^Row ${row}, column ${col}, `) }).click();
}

async function setFoundryLine(page: Page, count: number) {
  await page.getByRole('button', { name: new RegExp(`^Foundry line slot ${count},`) }).click();
}

/** Round 1 of the worked example: two lone tiles, 3 on the foundry line. */
async function playRound1(page: Page) {
  await tapSpace(page, 1, 1);
  await tapSpace(page, 3, 1);
  await setFoundryLine(page, 3);
  await expect(page.getByTestId('round-preview')).toHaveText('This Round −2');
  await expect(page.getByTestId('running-total')).toHaveText('0 Points');
  await page.getByRole('button', { name: 'Confirm Round' }).click();
  await expect(page.getByRole('heading', { name: 'Round 2' })).toBeVisible();
  await expect(page.getByTestId('round-1')).toContainText('0');
}

/** Round 2: a column run of 3, then 4, and 1 on the foundry line. */
async function playRound2(page: Page) {
  await tapSpace(page, 2, 1);
  await tapSpace(page, 4, 1);
  await setFoundryLine(page, 1);
  await expect(page.getByTestId('round-preview')).toHaveText('This Round +6');
  await expect(page.getByTestId('running-total')).toHaveText('6 Points');
}

test('guest: worked rounds, round errors on the editor, leave and resume on this device', async ({
  page,
}) => {
  await page.goto(SCORE);
  await expect(page.getByText('No games in progress on this device.')).toBeVisible();
  await page.getByRole('button', { name: 'New Game' }).click();
  await expect(page).toHaveURL(/\/games\/azul\/score\/[0-9a-f-]{36}$/);
  const gameUrl = page.url();

  await playRound1(page);

  // AZU-ROUND-2: two new tiles in one row.
  await tapSpace(page, 5, 2);
  await tapSpace(page, 5, 4);
  await expect(
    page.getByText('Row 5 has 2 new tiles. Only 1 tile per row each round.'),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirm Round' })).toBeDisabled();
  await tapSpace(page, 5, 2);
  await tapSpace(page, 5, 4);
  // AZU-ROUND-3: removing a confirmed tile.
  await tapSpace(page, 1, 1);
  await expect(page.getByText(/Row 1, column 1 had a tile last round/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirm Round' })).toBeDisabled();
  await tapSpace(page, 1, 1);

  await playRound2(page);
  // A refresh keeps the taps of the round being entered.
  await page.reload();
  await expect(page.getByTestId('running-total')).toHaveText('6 Points');
  await page.getByRole('button', { name: 'Confirm Round' }).click();
  await expect(page.getByTestId('round-2')).toContainText('6');

  // Leave and come back from the score home.
  await page.goto('/');
  await page.goto(SCORE);
  await page.getByRole('link', { name: /^Started .* 6 Points$/ }).click();
  await expect(page).toHaveURL(gameUrl);
  await expect(page.getByRole('heading', { name: 'Round 3' })).toBeVisible();

  // Final round completes column 1: a run of 5, then +7.
  await tapSpace(page, 5, 1);
  await page.getByRole('button', { name: 'Confirm Final Round' }).click();
  await expect(page.getByTestId('score-total')).toHaveText('18 Points');
  await expect(page.getByTestId('category-columns')).toHaveText('7');
  await page.getByRole('button', { name: "Don't Save" }).click();
  await expect(page).toHaveURL(new RegExp(`${SCORE}$`));
  await expect(page.getByText('No games in progress on this device.')).toBeVisible();
});

test('signed in: start on one device, resume on another, finish into history', async ({
  browser,
}) => {
  const phone = await signedInDevice(browser);
  await phone.goto(SCORE);
  await phone.getByRole('button', { name: 'New Game' }).click();
  await expect(phone).toHaveURL(/\/games\/azul\/score\/[0-9a-f-]{36}$/);
  const gameUrl = phone.url();
  await playRound1(phone);

  const tablet = await signedInDevice(browser);
  await tablet.goto(SCORE);
  await tablet.getByRole('link', { name: /^Started .* 0 Points$/ }).click();
  await expect(tablet).toHaveURL(gameUrl);
  await expect(tablet.getByRole('heading', { name: 'Round 2' })).toBeVisible();
  await playRound2(tablet);
  await tablet.getByRole('button', { name: 'Confirm Final Round' }).click();

  await expect(tablet).toHaveURL(/\/games\/azul\/history\/[0-9a-f-]{36}$/);
  await expect(tablet.getByTestId('score-total')).toHaveText('6 Points');
  await expect(tablet.getByTestId('category-rows')).toHaveText('0');

  // The finished game is no longer in progress, and its old URL opens it in history.
  await phone.goto(SCORE);
  await expect(phone.getByText('No games in progress.')).toBeVisible();
  await phone.goto(gameUrl);
  await expect(phone).toHaveURL(/\/games\/azul\/history\//);
  await phone.context().close();
  await tablet.context().close();
});
