import { randomUUID } from 'node:crypto';

import { createClient } from '@supabase/supabase-js';
import { ErrorEnvelopeSchema } from '@tablekeeper/core';

import { loadConfig, type Config } from '../config';
import type { Database } from '../db/database.types';

/** Config for tests: local Supabase (filled by vitest.config.ts) and defaults for the rest. */
export function testConfig(overrides: Record<string, string> = {}): Config {
  return loadConfig({ ...process.env, NODE_ENV: 'test', LOG_LEVEL: 'silent', ...overrides });
}

/** Config that never reaches a database, for routes that don't need one. */
export function offlineConfig(overrides: Record<string, string> = {}): Config {
  return loadConfig({
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    SUPABASE_URL: 'http://127.0.0.1:9',
    SUPABASE_ANON_KEY: 'anon',
    SUPABASE_SERVICE_ROLE_KEY: 'service',
    ...overrides,
  });
}

export type TestUser = { id: string; email: string; token: string };

const auth = { persistSession: false, autoRefreshToken: false };

/** Creates a confirmed user with a uniquely prefixed email and signs in. Delete with `deleteUsers`. */
export async function createTestUser(
  config: Config,
  prefix: string,
  name = 'Test Player',
): Promise<TestUser> {
  const admin = createClient<Database>(config.supabase.url, config.supabase.serviceRoleKey, {
    auth,
  });
  const email = `${prefix}-${randomUUID().slice(0, 8)}@local`;
  const password = `pw-${randomUUID()}`;
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: name },
  });
  if (created.error) throw created.error;
  const anon = createClient<Database>(config.supabase.url, config.supabase.anonKey, { auth });
  const session = await anon.auth.signInWithPassword({ email, password });
  if (session.error) throw session.error;
  return { id: created.data.user.id, email, token: session.data.session.access_token };
}

export async function deleteUsers(config: Config, users: TestUser[]): Promise<void> {
  const admin = createClient<Database>(config.supabase.url, config.supabase.serviceRoleKey, {
    auth,
  });
  for (const user of users) await admin.auth.admin.deleteUser(user.id);
}

/** The error from a response's envelope, validated. */
export function errorBody(res: { body: unknown }) {
  return ErrorEnvelopeSchema.parse(res.body).error;
}
