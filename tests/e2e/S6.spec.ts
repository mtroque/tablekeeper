import { expect, test } from '@playwright/test';

const SCORE = '/games/dorfromantik/score';

test('a counter takes a typed number: Enter, blur, clear, letters, over max, Escape, − / +', async ({
  page,
}) => {
  await page.goto(SCORE);
  await expect(page.getByRole('heading', { name: 'Game 1' })).toBeVisible();
  const forest = page.getByRole('textbox', { name: 'Forest', exact: true });
  const grain = page.getByRole('textbox', { name: 'Grain', exact: true });
  const total = page.getByTestId('sheet-total');

  // Tapping the value opens the numeric keyboard with the value selected, so typing replaces it.
  await expect(forest).toHaveAttribute('inputmode', 'numeric');
  await forest.click();
  await expect(forest).toBeFocused();
  expect(
    await forest.evaluate((el: HTMLInputElement) => [el.selectionStart, el.selectionEnd]),
  ).toEqual([0, 1]);

  // The total follows each valid keystroke; Enter keeps 37 and closes the field.
  await page.keyboard.type('3');
  await expect(total).toHaveText('3');
  await page.keyboard.type('7');
  await expect(total).toHaveText('37');
  await page.keyboard.press('Enter');
  await expect(forest).not.toBeFocused();
  await expect(forest).toHaveValue('37');

  // Tapping away commits too.
  await grain.click();
  await page.keyboard.type('12');
  await forest.click();
  await expect(grain).toHaveValue('12');
  await expect(total).toHaveText('49');

  // Clearing and leaving restores the value; letters can't be typed.
  await forest.press('Backspace');
  await expect(forest).toHaveValue('');
  await grain.click();
  await expect(forest).toHaveValue('37');
  await forest.click();
  await page.keyboard.type('abc');
  await expect(forest).toHaveValue('');
  await page.keyboard.press('Enter');
  await expect(forest).toHaveValue('37');

  // Over max (999) sets max.
  await forest.click();
  await page.keyboard.type('1000');
  await expect(forest).toHaveValue('999');
  await page.keyboard.press('Enter');
  await expect(total).toHaveText('1011');

  // Escape restores the value from before editing, even after the total followed the typing.
  await forest.click();
  await page.keyboard.type('5');
  await expect(total).toHaveText('17');
  await page.keyboard.press('Escape');
  await expect(forest).toHaveValue('999');
  await expect(total).toHaveText('1011');

  // − / + step by 1 within min and max.
  const increase = page.getByRole('button', { name: 'Increase Forest', exact: true });
  const decrease = page.getByRole('button', { name: 'Decrease Forest', exact: true });
  await expect(increase).toBeDisabled();
  await decrease.click();
  await expect(forest).toHaveValue('998');
  await expect(total).toHaveText('1010');
  await increase.click();
  await expect(forest).toHaveValue('999');
  await forest.click();
  await page.keyboard.type('1');
  await page.keyboard.press('Enter');
  await decrease.click();
  await expect(forest).toHaveValue('0');
  await expect(decrease).toBeDisabled();
  await expect(total).toHaveText('12');

  // A refresh keeps the typed values.
  await page.reload();
  await expect(grain).toHaveValue('12');
});
