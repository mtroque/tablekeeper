import { createApiClient, type ApiClient } from './api-client';
import { getAuthSession } from './auth';
import { publicEnv } from './env';

let client: ApiClient | undefined;

/** The app's API client, carrying the signed-in user's token. */
export function api(): ApiClient {
  client ??= createApiClient({
    baseUrl: publicEnv().NEXT_PUBLIC_API_URL,
    getToken: async () => (await getAuthSession())?.token ?? null,
  });
  return client;
}
