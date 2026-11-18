import type { RequestHandler } from 'express';
import { createRemoteJWKSet, decodeProtectedHeader, jwtVerify, type JWTPayload } from 'jose';
import { z } from 'zod';

import { createUserDb, type Clients } from '../db/client';
import { ensureProfile } from '../db/profiles';
import { AppError, unauthenticated } from '../errors';

const UuidSchema = z.uuid();

function bearerToken(header: string | undefined): string | undefined {
  if (!header) return undefined;
  const match = /^Bearer\s+(\S+)$/i.exec(header);
  if (!match?.[1]) throw new AppError('UNAUTHENTICATED', 401, 'The sign-in token is malformed.');
  return match[1];
}

function displayNameFor(payload: JWTPayload, email: string | null): string {
  const name = typeof payload.name === 'string' ? payload.name.trim() : '';
  const emailLocal = email?.split('@')[0]?.trim() ?? '';
  return name || emailLocal || 'Player';
}

/**
 * Where Neon Auth's tokens come from: the issuer (`iss`) is the origin of `NEON_AUTH_BASE_URL`
 * without its path, while the JWKS lives under the full base URL. The one place this is derived;
 * `auth.test.ts` pins it to literal values so code and test helpers can't share a wrong guess.
 */
export function neonAuthEndpoints(baseUrl: string): { issuer: string; jwksUrl: string } {
  const base = baseUrl.replace(/\/$/, '');
  return { issuer: new URL(base).origin, jwksUrl: `${base}/.well-known/jwks.json` };
}

/**
 * Verifies a Neon Auth JWT when one is sent (using JWKS, or `AUTH_TEST_SECRET` in test mode),
 * ensures the user's profile row exists, and sets `req.auth` with a user-scoped database client.
 * A missing token means a guest; an invalid or expired one is a 401.
 */
export function optionalAuth(clients: Clients): RequestHandler {
  const { issuer, jwksUrl } = neonAuthEndpoints(clients.auth.baseUrl);
  const jwks = createRemoteJWKSet(new URL(jwksUrl));
  const testKey = clients.auth.testSecret
    ? new TextEncoder().encode(clients.auth.testSecret)
    : undefined;

  return async (req, _res, next) => {
    const token = bearerToken(req.get('authorization'));
    if (!token) {
      next();
      return;
    }

    let payload: JWTPayload;
    try {
      const header = decodeProtectedHeader(token);
      const verified =
        testKey && header.alg === 'HS256'
          ? await jwtVerify(token, testKey, { issuer, algorithms: ['HS256'] })
          : await jwtVerify(token, jwks, { issuer });
      payload = verified.payload;
    } catch {
      throw new AppError('UNAUTHENTICATED', 401, 'Your sign-in has expired. Sign in again.');
    }

    const sub = UuidSchema.safeParse(payload.sub);
    if (!sub.success) {
      throw new AppError('UNAUTHENTICATED', 401, 'Your sign-in has expired. Sign in again.');
    }

    const userId = sub.data;
    const email = typeof payload.email === 'string' ? payload.email : null;
    const db = createUserDb(clients.service, userId);
    await ensureProfile(db, userId, displayNameFor(payload, email));
    req.auth = { userId, email, db };
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
