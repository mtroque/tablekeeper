import { rateLimit } from 'express-rate-limit';

import type { Config } from '../config';
import { AppError } from '../errors';

/** Burst limit for every `/v1` route. */
export function burstLimit(config: Config['rateLimit']) {
  return rateLimit({
    windowMs: config.windowMs,
    limit: config.max,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, _res, next) => {
      next(new AppError('RATE_LIMITED', 429, 'Too many requests. Wait a minute and try again.'));
    },
  });
}
