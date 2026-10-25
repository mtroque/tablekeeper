import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { Config } from '../config';

import type { Database } from './database.types';

export type Db = SupabaseClient<Database>;

export type SupabaseClients = {
  config: Config['supabase'];
  /** Anon key, no user: verifies tokens. */
  anon: Db;
  /** Service role: bypasses row level security. Only for tables with no user policies. */
  service: Db;
};

const serverAuth = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false };

export function createSupabaseClients(config: Config['supabase']): SupabaseClients {
  return {
    config,
    anon: createClient<Database>(config.url, config.anonKey, { auth: serverAuth }),
    service: createClient<Database>(config.url, config.serviceRoleKey, { auth: serverAuth }),
  };
}

/** A client that acts as the signed-in user, so row level security applies. */
export function createUserClient(config: Config['supabase'], accessToken: string): Db {
  return createClient<Database>(config.url, config.anonKey, {
    auth: serverAuth,
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}
