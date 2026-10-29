import { expect, test } from '@playwright/test';

const API = process.env.NEXT_PUBLIC_API_URL ?? '';

test('a blocked health check shows no server status line', async ({ page }) => {
  let healthCalls = 0;
  await page.route(`${API}/health`, (route) => {
    healthCalls++;
    return route.abort('blockedbyclient');
  });
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
  // The first call and the client's single retry, both blocked; then give the slow timer time.
  await expect.poll(() => healthCalls).toBeGreaterThanOrEqual(2);
  await page.waitForTimeout(3000);
  expect(
    await page.evaluate(() => (window as unknown as { tkStatusSeen?: boolean }).tkStatusSeen),
  ).toBeUndefined();
  await expect(page.getByText("Couldn't reach the server.")).toHaveCount(0);
});

test('a slow health check still shows the waking line', async ({ page }) => {
  // Never answered, like a sleeping Render instance.
  await page.route(`${API}/health`, () => undefined);
  await page.goto('/');

  await expect(page.getByTestId('status-waking')).toHaveText(
    'Waking up the server. This can take up to a minute.',
  );
  await expect(page.getByRole('heading', { name: 'Your Games' })).toBeVisible();
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
