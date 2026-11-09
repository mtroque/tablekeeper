import { expect, test } from '@playwright/test';

const API = process.env.NEXT_PUBLIC_API_URL ?? '';

test('the home page loads with no server status line and no health check', async ({ page }) => {
  const healthCalls: string[] = [];
  page.on('request', (req) => {
    if (req.url().startsWith(`${API}/health`)) healthCalls.push(req.url());
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
  await expect(page.getByTestId('game-card-patchwork')).toBeVisible();
  // Past the old 2500ms waking timer.
  await page.waitForTimeout(3000);
  expect(
    await page.evaluate(() => (window as unknown as { tkStatusSeen?: boolean }).tkStatusSeen),
  ).toBeUndefined();
  await expect(page.getByText('Waking up the server.')).toHaveCount(0);
  expect(healthCalls).toEqual([]);
});

test('going offline shows the offline line, and coming back clears it', async ({
  page,
  context,
}) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Your Games' })).toBeVisible();

  await context.setOffline(true);
  await expect(page.getByTestId('status-offline')).toHaveText(
    "You're offline. Scoring still works; saving and rules need a connection.",
  );
  await context.setOffline(false);
  await expect(page.getByTestId('status-offline')).toHaveCount(0);
});
