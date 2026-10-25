import { expect, test } from '@playwright/test';

import { signInAs } from './helpers';

const TAGS = {
  patchwork: ['Rules', 'Photo Scoring'],
  azul: ['Rules', 'Scoring'],
  harmonies: ['Rules', 'Photo Scoring'],
  dorfromantik: ['Rules', 'Scoring', 'Campaign'],
};

test('library lists the four games with their feature tags', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Your Games' })).toBeVisible();
  for (const [id, tags] of Object.entries(TAGS)) {
    const card = page.getByTestId(`game-card-${id}`);
    await expect(card.getByRole('listitem')).toHaveText(tags);
  }
  await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
});

test('library card opens the hub with the right tabs', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('game-card-patchwork').click();
  await expect(page).toHaveURL(/\/games\/patchwork\/score$/);
  const tabs = page.getByRole('navigation', { name: 'Game sections' }).getByRole('link');
  await expect(tabs).toHaveText(['Score', 'Rules', 'History']);
  await expect(tabs.first()).toHaveAttribute('aria-current', 'page');
  // Coming soon until the game's scorer slice lands, then its score home.
  await expect(
    page.getByTestId('coming-soon').or(page.getByRole('button', { name: 'Enter by Hand' })),
  ).toBeVisible();

  await tabs.filter({ hasText: 'Rules' }).click();
  await expect(page).toHaveURL(/\/games\/patchwork\/rules$/);

  await page.goto('/games/dorfromantik');
  await expect(
    page.getByRole('navigation', { name: 'Game sections' }).getByRole('link'),
  ).toHaveText(['Score', 'Campaign', 'Rules', 'History']);

  await page.goto('/games/azul/campaign');
  await expect(page.getByRole('heading', { name: 'Page Not Found' })).toBeVisible();
  await page.goto('/games/chess');
  await expect(page.getByRole('heading', { name: 'Page Not Found' })).toBeVisible();
});

test('desktop shows the centered column with the QR side note; phones do not', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const column = await page.getByTestId('app-column').boundingBox();
  expect(column?.width).toBe(430);
  expect((column?.x ?? 0) + (column?.width ?? 0) / 2).toBeCloseTo(720, 0);
  const note = page.getByTestId('phone-side-note');
  await expect(note).toBeVisible();
  await expect(note.getByRole('heading', { name: 'Made for Your Phone' })).toBeVisible();
  await expect(note.getByRole('img', { name: 'QR code for this page' })).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(note).toBeHidden();
});

test('Sign In starts Google sign-in through Supabase', async ({ page }) => {
  let authorizeUrl: URL | undefined;
  await page.route('**/auth/v1/authorize**', async (route) => {
    authorizeUrl = new URL(route.request().url());
    await route.fulfill({ status: 200, body: 'stopped before Google' });
  });
  await page.goto('/games/harmonies/rules');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect.poll(() => authorizeUrl?.searchParams.get('provider')).toBe('google');
  expect(authorizeUrl?.searchParams.get('redirect_to')).toMatch(
    /^http:\/\/localhost:\d+\/auth\/callback$/,
  );
});

test('a seeded user is signed in, sees their profile and can sign out', async ({ page }) => {
  await signInAs(page);
  await page.goto('/');
  const avatar = page.getByRole('button', { name: 'Account: E2E Player' });
  await expect(avatar).toBeVisible();
  await avatar.click();
  await expect(page.getByTestId('account-name')).toHaveText('E2E Player');
  await expect(page.getByText('e2e@local')).toBeVisible();
  await page.getByRole('button', { name: 'Sign Out' }).click();
  await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
});
