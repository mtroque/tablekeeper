import { createApiClient, type ApiClient } from './api-client';
import { publicEnv } from './env';
import { supabase } from './supabase';

let client: ApiClient | undefined;

/** The app's API client, carrying the signed-in user's token. */
export function api(): ApiClient {
  client ??= createApiClient({
    baseUrl: publicEnv().NEXT_PUBLIC_API_URL,
    getToken: async () => (await supabase().auth.getSession()).data.session?.access_token ?? null,
  });
  return client;
}
