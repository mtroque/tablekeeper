import { createClient, type User } from '@supabase/supabase-js';
import type { RequestHandler } from 'express';

import { createUserDb, type Clients } from '../db/client';
import { ensureProfile } from '../db/profiles';
import { AppError, unauthenticated } from '../errors';

const serverAuth = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false };

function bearerToken(header: string | undefined): string | undefined {
  if (!header) return undefined;
  const match = /^Bearer\s+(\S+)$/i.exec(header);
  if (!match?.[1]) throw new AppError('UNAUTHENTICATED', 401, 'The sign-in token is malformed.');
  return match[1];
}

function displayNameFor(user: User): string {
  const meta: Record<string, unknown> = user.user_metadata;
  const fullName = typeof meta.full_name === 'string' ? meta.full_name.trim() : '';
  const name = typeof meta.name === 'string' ? meta.name.trim() : '';
  const emailLocal = user.email?.split('@')[0]?.trim() ?? '';
  return fullName || name || emailLocal || 'Player';
}

/**
 * Verifies a Supabase access token when one is sent, ensures the user's profile row exists,
 * and sets `req.auth` with a user-scoped database client.
 * A missing token means a guest; an invalid or expired one is a 401, so the client refreshes it.
 */
export function optionalAuth(clients: Clients): RequestHandler {
  const anon = createClient(clients.supabase.url, clients.supabase.anonKey, { auth: serverAuth });
  return async (req, _res, next) => {
    const token = bearerToken(req.get('authorization'));
    if (!token) {
      next();
      return;
    }
    const { data, error } = await anon.auth.getUser(token);
    if (error) {
      throw new AppError('UNAUTHENTICATED', 401, 'Your sign-in has expired. Sign in again.');
    }
    const db = createUserDb(clients.service, data.user.id);
    await ensureProfile(db, data.user.id, displayNameFor(data.user));
    req.auth = {
      userId: data.user.id,
      email: data.user.email ?? null,
      db,
    };
    next();
  };
}

/** Like `optionalAuth`, but guests get a 401. */
export function requireAuth(clients: Clients): RequestHandler {
  const verify = optionalAuth(clients);
  return async (req, res, next) => {
    await verify(req, res, () => undefined);
    if (!req.auth) throw unauthenticated();
    next();
  };
}
