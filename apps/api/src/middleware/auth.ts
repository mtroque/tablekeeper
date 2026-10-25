import type { RequestHandler } from 'express';

import { createUserClient, type SupabaseClients } from '../db/client';
import { AppError, unauthenticated } from '../errors';

function bearerToken(header: string | undefined): string | undefined {
  if (!header) return undefined;
  const match = /^Bearer\s+(\S+)$/i.exec(header);
  if (!match?.[1]) throw new AppError('UNAUTHENTICATED', 401, 'The sign-in token is malformed.');
  return match[1];
}

/**
 * Verifies a Supabase access token when one is sent and sets `req.auth`.
 * A missing token means a guest; an invalid or expired one is a 401, so the client refreshes it.
 */
export function optionalAuth(clients: SupabaseClients): RequestHandler {
  return async (req, _res, next) => {
    const token = bearerToken(req.get('authorization'));
    if (!token) {
      next();
      return;
    }
    const { data, error } = await clients.anon.auth.getUser(token);
    if (error) {
      throw new AppError('UNAUTHENTICATED', 401, 'Your sign-in has expired. Sign in again.');
    }
    req.auth = {
      userId: data.user.id,
      email: data.user.email ?? null,
      db: createUserClient(clients.config, token),
    };
    next();
  };
}

/** Like `optionalAuth`, but guests get a 401. */
export function requireAuth(clients: SupabaseClients): RequestHandler {
  const verify = optionalAuth(clients);
  return async (req, res, next) => {
    await verify(req, res, () => undefined);
    if (!req.auth) throw unauthenticated();
    next();
  };
}
