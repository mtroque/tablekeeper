import { expect, test } from '@playwright/test';

const API = process.env.NEXT_PUBLIC_API_URL ?? '';

test('a blocked health check shows no server status line', async ({ page }) => {
  await page.route(`${API}/health`, (route) => route.abort('blockedbyclient'));
  // Fails the test if any status line shows, even for a moment.
  await page.addInitScript(() => {
    new MutationObserver(() => {
      if (document.querySelector('[data-testid^="status-"]')) {
        (window as unknown as { tkStatusSeen: boolean }).tkStatusSeen = true;
      }
    }).observe(document, { childList: true, subtree: true });
  });
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Your Games' })).toBeVisible();
  await expect(page.getByTestId('game-card-azul')).toBeVisible();
  // Long enough for the client's single retry of any blocked call.
  await page.waitForTimeout(3000);
  expect(
    await page.evaluate(() => (window as unknown as { tkStatusSeen?: boolean }).tkStatusSeen),
  ).toBeUndefined();
  await expect(page.getByText("Couldn't reach the server.")).toHaveCount(0);
});

test('a rules question with the API unreachable says so on that turn', async ({ page }) => {
  await page.route(`${API}/**`, (route) => route.abort('connectionrefused'));
  await page.goto('/games/azul/rules');

  await page.getByRole('button', { name: 'When does the game end?' }).click();
  const error = page.getByTestId('answer-error');
  await expect(error).toContainText("Couldn't reach the server. Try again.");
  await expect(error.getByRole('button', { name: 'Try Again' })).toBeVisible();
  await expect(page.getByTestId('status-down')).toHaveCount(0);
});
