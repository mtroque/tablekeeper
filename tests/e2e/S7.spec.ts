import { expect, test } from '@playwright/test';

const GAME = 'azul';

test('after a failed ask, the quota pill refetches and matches the server', async ({ page }) => {
  let quotaCalls = 0;
  await page.route('**/v1/me/quota', async (route) => {
    quotaCalls += 1;
    // First load: 5 left. After the failed ask invalidates ['quota'], return 4 to prove
    // the pill reflects the fresh server response rather than keeping a stale client count.
    const used = quotaCalls === 1 ? 0 : 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        enabled: true,
        subject: 'guest',
        limit: 5,
        used,
        remaining: 5 - used,
        resetsAt: '2026-11-25T00:00:00.000Z',
      }),
    });
  });

  await page.route(`**/v1/games/${GAME}/rules/ask`, async (route) => {
    await route.fulfill({
      status: 502,
      contentType: 'application/json',
      body: JSON.stringify({
        error: { code: 'INTERNAL', message: "Couldn't get an answer right now. Try again." },
      }),
    });
  });

  await page.goto(`/games/${GAME}/rules`);
  await expect(page.getByTestId('quota-pill')).toHaveText('5 left today');

  await page.getByRole('button', { name: 'When does the game end?' }).click();
  await expect(page.getByText("Couldn't get an answer right now. Try again.")).toBeVisible();
  await expect(page.getByTestId('quota-pill')).toHaveText('4 left today');
  expect(quotaCalls).toBeGreaterThanOrEqual(2);
});
