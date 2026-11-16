import { randomUUID } from 'node:crypto';

import type { Page } from '@playwright/test';
import { SignJWT } from 'jose';

import { createDb } from '../../apps/api/src/db/client';
import { TEST_USER_DETAILS, type TEST_USERS } from '../../scripts/lib/test-users.mjs';

/** Must match AUTH_STORAGE_KEY in apps/web/src/lib/auth.ts. */
export const AUTH_STORAGE_KEY = 'tk:auth';

export type E2eUser = { id: string; email: string; name: string };

function authEnv() {
  const databaseUrl = process.env.DATABASE_URL;
  const issuer = process.env.NEON_AUTH_BASE_URL;
  const secret = process.env.AUTH_TEST_SECRET;
  if (!databaseUrl || !issuer || !secret) {
    throw new Error('Test auth env missing; playwright.config.ts fills it.');
  }
  return { databaseUrl, issuer: issuer.replace(/\/$/, ''), secret };
}

/** Mints a local test JWT and serializes the browser session object. */
export async function signTestSession(user: E2eUser): Promise<string> {
  const { issuer, secret } = authEnv();
  const token = await new SignJWT({ email: user.email, name: user.name })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuer(new URL(issuer).origin)
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(new TextEncoder().encode(secret));
  return JSON.stringify({ token, user });
}

/** Inserts a test user into `neon_auth."user"`. Delete with `deleteTestUsers`. */
export async function createTestUser(prefix: string, name = 'Test Player'): Promise<E2eUser> {
  const { databaseUrl } = authEnv();
  const id = randomUUID();
  const email = `${prefix}-${id.slice(0, 8)}@local`;
  const db = createDb(databaseUrl);
  await db`
    insert into neon_auth."user" (id, email, name)
    values (${id}::uuid, ${email}, ${name})
  `;
  return { id, email, name };
}

export async function deleteTestUsers(users: E2eUser[]): Promise<void> {
  const { databaseUrl } = authEnv();
  const ids = users.map((u) => u.id);
  if (ids.length === 0) return;
  const db = createDb(databaseUrl);
  await db`delete from public.play_sessions where user_id = any(${ids}::uuid[])`;
  await db`delete from public.campaigns where user_id = any(${ids}::uuid[])`;
  await db`delete from public.profiles where id = any(${ids}::uuid[])`;
  await db`delete from neon_auth."user" where id = any(${ids}::uuid[])`;
}

/** Injects a serialized test session into `localStorage` once per tab. */
export async function signInWithSession(page: Page, session: string): Promise<void> {
  await page.addInitScript(
    ([key, value]) => {
      if (!sessionStorage.getItem('tk:e2e-signed-in')) {
        localStorage.setItem(key, value);
        sessionStorage.setItem('tk:e2e-signed-in', '1');
      }
    },
    [AUTH_STORAGE_KEY, session] as const,
  );
}

/** Signs a seeded user in using a minted test JWT (never real Google). */
export async function signInAs(
  page: Page,
  user: keyof typeof TEST_USERS = 'default',
): Promise<void> {
  const detail = TEST_USER_DETAILS[user];
  const session = await signTestSession(detail);
  await signInWithSession(page, session);
}
