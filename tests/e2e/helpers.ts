import type { Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

import { TEST_PASSWORD, TEST_USERS } from '../../scripts/lib/test-users.mjs';

/** Must match AUTH_STORAGE_KEY in apps/web/src/lib/supabase.ts. */
const AUTH_STORAGE_KEY = 'tk:auth';

/** Signs a seeded user in by password and hands the session to the page (never real Google). */
export async function signInAs(
  page: Page,
  user: keyof typeof TEST_USERS = 'default',
): Promise<void> {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error('Supabase env missing; playwright.config.ts fills it.');
  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInWithPassword({
    email: TEST_USERS[user],
    password: TEST_PASSWORD,
  });
  if (error) throw error;
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
