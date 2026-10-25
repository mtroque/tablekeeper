import { pino, type Logger } from 'pino';

import type { Config } from './config';

/** Never log tokens, photos or rulebook text; the redactions are a backstop. */
export function createLogger(config: Pick<Config, 'logLevel'>): Logger {
  return pino({
    level: config.logLevel,
    redact: ['req.headers.authorization', 'headers.authorization', '*.token', '*.accessToken'],
  });
}
