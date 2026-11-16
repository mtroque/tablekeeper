import { createAuthClient } from '@neondatabase/auth';
import { BetterAuthVanillaAdapter } from '@neondatabase/auth/vanilla';
import { z } from 'zod';

import { publicEnv } from './env';

/** Local test-session storage key used by e2e tests (production uses Neon Auth cookies). */
export const AUTH_STORAGE_KEY = 'tk:auth';

export type AuthUser = {
  id: string;
  email: string | null;
  name: string | null;
};

export type AuthSession = {
  token: string;
  user: AuthUser;
};

const TestSessionSchema = z.object({
  token: z.string().min(1),
  user: z.object({
    id: z.string().min(1),
    email: z.string().nullable().default(null),
    name: z.string().nullable().default(null),
  }),
});

function createClient() {
  return createAuthClient(publicEnv().NEXT_PUBLIC_NEON_AUTH_URL, {
    adapter: BetterAuthVanillaAdapter(),
  });
}

type NeonAuthClient = ReturnType<typeof createClient>;
let client: NeonAuthClient | undefined;

function authClient(): NeonAuthClient {
  client ??= createClient();
  return client;
}

function readTestSession(): AuthSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = TestSessionSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function isJwt(token: string): boolean {
  return token.split('.').length === 3;
}

/** Returns the current signed-in session and JWT, or null for guests. */
export async function getAuthSession(): Promise<AuthSession | null> {
  const testSession = readTestSession();
  if (testSession) return testSession;

  if (publicEnv().NEXT_PUBLIC_NEON_AUTH_URL.startsWith('http://127.0.0.1:9')) {
    return null;
  }

  try {
    const { data, error } = await authClient().getSession();
    if (error || !data?.session) return null;

    let token = data.session.token;
    if (!isJwt(token)) {
      const jwtRes = await authClient().token();
      if (jwtRes.error || !jwtRes.data.token) return null;
      token = jwtRes.data.token;
    }

    return {
      token,
      user: {
        id: data.user.id,
        email: data.user.email || null,
        name: data.user.name || null,
      },
    };
  } catch {
    return null;
  }
}

export async function signInWithGoogle(): Promise<void> {
  const { error } = await authClient().signIn.social({
    provider: 'google',
    callbackURL: `${window.location.origin}/auth/callback`,
  });
  if (error) throw new Error(error.message ?? 'Google sign-in failed.');
}

export async function signOutUser(): Promise<void> {
  const hadTestSession = readTestSession() !== null;
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    } catch {
      // Storage can be unavailable.
    }
  }
  if (!hadTestSession) {
    await authClient().signOut();
  }
}
