import type { Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

import { TEST_PASSWORD, TEST_USER_DETAILS, TEST_USERS } from '../../scripts/lib/test-users.mjs';

/** Must match AUTH_STORAGE_KEY in apps/web/src/lib/supabase.ts. */
const AUTH_STORAGE_KEY = 'tk:auth';
const auth = { persistSession: false, autoRefreshToken: false };

/** Signs a seeded user in by password (creating the Auth user if missing) and hands the session to the page. */
export async function signInAs(
  page: Page,
  user: keyof typeof TEST_USERS = 'default',
): Promise<void> {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey) throw new Error('Supabase env missing; playwright.config.ts fills it.');
  const client = createClient(url, anonKey, { auth });
  let { data, error } = await client.auth.signInWithPassword({
    email: TEST_USERS[user],
    password: TEST_PASSWORD,
  });
  if (error && serviceKey) {
    const detail = TEST_USER_DETAILS[user];
    const admin = createClient(url, serviceKey, { auth });
    await admin.auth.admin.createUser({
      id: detail.id,
      email: detail.email,
      password: TEST_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: detail.name },
    });
    ({ data, error } = await client.auth.signInWithPassword({
      email: TEST_USERS[user],
      password: TEST_PASSWORD,
    }));
  }
  if (error || !data.session) throw error ?? new Error('Failed to sign in test user');
  await page.addInitScript(
    ([key, value]) => {
      if (!sessionStorage.getItem('tk:e2e-signed-in')) {
        localStorage.setItem(key, value);
        sessionStorage.setItem('tk:e2e-signed-in', '1');
      }
    },
    [AUTH_STORAGE_KEY, JSON.stringify(data.session)] as const,
  );
}
