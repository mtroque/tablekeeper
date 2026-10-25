import { randomUUID } from 'node:crypto';

import type { RequestHandler } from 'express';
import type { Logger } from 'pino';

const ID_PATTERN = /^[\w-]{1,64}$/;

/** Assigns a request id (or keeps a well-formed incoming one) and logs each response. */
export function requestId(logger: Logger): RequestHandler {
  return (req, res, next) => {
    const incoming = req.get('x-request-id');
    req.id = incoming && ID_PATTERN.test(incoming) ? incoming : randomUUID();
    res.setHeader('x-request-id', req.id);
    const started = performance.now();
    res.on('finish', () => {
      logger.info(
        {
          requestId: req.id,
          method: req.method,
          path: req.path,
          status: res.statusCode,
          ms: Math.round(performance.now() - started),
        },
        'request',
      );
    });
    next();
  };
}
