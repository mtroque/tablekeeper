import { rateLimit } from 'express-rate-limit';

import type { Config } from '../config';
import type { SupabaseClients } from '../db/client';
import { SupabaseRateLimitStore } from '../db/rate-limit-store';
import { AppError } from '../errors';

/**
 * Burst limit for every `/v1` route. On a serverless host each instance has its own memory,
 * so production counts in the database (`RATE_LIMIT_STORE=database`); local dev and tests
 * keep the in-memory default.
 */
export function burstLimit(config: Config, clients: SupabaseClients) {
  const store =
    config.rateLimit.store === 'database'
      ? new SupabaseRateLimitStore(clients.service, config.quotas.ipHashSalt)
      : undefined;
  return rateLimit({
    windowMs: config.rateLimit.windowMs,
    limit: config.rateLimit.max,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    ...(store ? { store } : {}),
    handler: (_req, _res, next) => {
      next(new AppError('RATE_LIMITED', 429, 'Too many requests. Wait a minute and try again.'));
    },
  });
}
