import { expect, test } from '@playwright/test';

test('the privacy page opens from the game library without signing in', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Privacy' }).click();

  await expect(page).toHaveURL(/\/privacy$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Privacy' })).toBeVisible();
  for (const section of [
    'Without an Account',
    'With an Account',
    'Board Photos',
    'Rules Questions',
    'Logs and Storage',
    'Services Used',
    'Questions',
  ]) {
    await expect(page.getByRole('heading', { level: 2, name: section, exact: true })).toBeVisible();
  }
  await expect(page.getByRole('link', { name: 'GitHub' })).toHaveAttribute(
    'href',
    'https://github.com/mtroque/tablekeeper/issues',
  );
});
