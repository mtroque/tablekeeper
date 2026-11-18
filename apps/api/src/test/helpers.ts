import { randomUUID } from 'node:crypto';

import { ErrorEnvelopeSchema } from '@tablekeeper/core';
import { SignJWT } from 'jose';

import { loadConfig, type Config } from '../config';
import { createDb } from '../db/client';
import { neonAuthEndpoints } from '../middleware/auth';

/** Config for tests: local Postgres and test JWT signing (filled by vitest.config.ts). */
export function testConfig(overrides: Record<string, string> = {}): Config {
  return loadConfig({ ...process.env, NODE_ENV: 'test', LOG_LEVEL: 'silent', ...overrides });
}

/** Config that never reaches a database, for routes that don't need one. */
export function offlineConfig(overrides: Record<string, string> = {}): Config {
  return loadConfig({
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:9/tablekeeper',
    NEON_AUTH_BASE_URL: 'http://127.0.0.1:9/auth',
    AUTH_TEST_SECRET: 'tablekeeper-local-test-secret',
    ...overrides,
  });
}

export type TestUser = { id: string; email: string; name: string; token: string };

/** Signs a test JWT for `user` using `config.auth.testSecret`. */
export async function signTestToken(
  config: Config,
  user: { id: string; email: string; name: string },
  opts: { issuer?: string; expiresIn?: string | number } = {},
): Promise<string> {
  const secret = config.auth.testSecret;
  if (!secret) throw new Error('AUTH_TEST_SECRET is required in test mode.');
  return new SignJWT({ email: user.email, name: user.name })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuer(opts.issuer ?? neonAuthEndpoints(config.auth.baseUrl).issuer)
    .setIssuedAt()
    .setExpirationTime(opts.expiresIn ?? '1h')
    .sign(new TextEncoder().encode(secret));
}

/** Creates a test user in `neon_auth."user"` and mints a JWT. Delete with `deleteUsers`. */
export async function createTestUser(
  config: Config,
  prefix: string,
  name = 'Test Player',
): Promise<TestUser> {
  const id = randomUUID();
  const email = `${prefix}-${id.slice(0, 8)}@local`;
  const db = createDb(config.databaseUrl);
  await db`
    insert into neon_auth."user" (id, email, name)
    values (${id}::uuid, ${email}, ${name})
  `;
  const token = await signTestToken(config, { id, email, name });
  return { id, email, name, token };
}

export async function deleteUsers(config: Config, users: TestUser[]): Promise<void> {
  const db = createDb(config.databaseUrl);
  const ids = users.map((u) => u.id);
  if (ids.length > 0) {
    await db`delete from public.play_sessions where user_id = any(${ids}::uuid[])`;
    await db`delete from public.campaigns where user_id = any(${ids}::uuid[])`;
    await db`delete from public.profiles where id = any(${ids}::uuid[])`;
    await db`delete from neon_auth."user" where id = any(${ids}::uuid[])`;
  }
}

/** The error from a response's envelope, validated. */
export function errorBody(res: { body: unknown }) {
  return ErrorEnvelopeSchema.parse(res.body).error;
}
