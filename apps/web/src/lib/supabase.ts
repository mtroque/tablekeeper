import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { publicEnv } from './env';

/** Where the browser keeps the Supabase session (also used by the e2e sign-in helper). */
export const AUTH_STORAGE_KEY = 'tk:auth';

let client: SupabaseClient | undefined;

/** The browser's Supabase client: auth only. Data goes through the API. */
export function supabase(): SupabaseClient {
  if (!client) {
    const env = publicEnv();
    client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      auth: {
        flowType: 'pkce',
        storageKey: AUTH_STORAGE_KEY,
        persistSession: true,
        detectSessionInUrl: true,
      },
    });
  }
  return client;
}
