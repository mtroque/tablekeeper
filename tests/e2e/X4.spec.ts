import { expect, test } from '@playwright/test';

import {
  AUTH_STORAGE_KEY,
  createTestUser,
  deleteTestUsers,
  signTestSession,
  type E2eUser,
} from './helpers';

let user: E2eUser;

test.beforeAll(async () => {
  user = await createTestUser('x4-e2e', 'Neon Auth Player');
});

test.afterAll(async () => {
  await deleteTestUsers([user]);
});

test('a guest result saved during Neon Auth Google sign-in lands in the account after callback', async ({
  page,
}) => {
  await page.route('**/sign-in/social**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        url: 'https://accounts.google.com/o/oauth2/v2/auth',
        redirect: false,
      }),
    }),
  );

  await page.goto('/games/patchwork/score');
  await page.getByRole('button', { name: 'Enter by Hand' }).click();
  await page.getByRole('button', { name: 'All Covered' }).click();
  await page.getByRole('link', { name: 'See Score' }).click();
  await expect(page.getByTestId('score-total')).toHaveText('0 Points');

  const socialRequest = page.waitForRequest('**/sign-in/social**');
  await page.getByRole('button', { name: 'Sign In with Google' }).click();
  const req = await socialRequest;
  expect(req.postDataJSON()).toMatchObject({ provider: 'google' });

  const session = await signTestSession(user);
  await page.goto('/');
  await page.evaluate(
    ([key, value]) => {
      localStorage.setItem(key, value);
    },
    [AUTH_STORAGE_KEY, session] as const,
  );
  await page.goto('/auth/callback');
  await expect(page).toHaveURL(/\/games\/patchwork\/history\/[0-9a-f-]{36}$/);
  await expect(page.getByTestId('score-total')).toHaveText('0 Points');
});
