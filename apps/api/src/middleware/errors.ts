import type { ErrorEnvelope } from '@tablekeeper/core';
import type { ErrorRequestHandler, RequestHandler } from 'express';
import type { Logger } from 'pino';

import { AppError, notFound } from '../errors';

export const notFoundRoute: RequestHandler = () => {
  throw notFound('That route');
};

/** Formats every error as the envelope; unknown errors become `INTERNAL` and are logged. */
export function errorHandler(logger: Logger): ErrorRequestHandler {
  return (err: unknown, req, res, _next) => {
    let error: AppError;
    if (err instanceof AppError) {
      error = err;
    } else if (isBodyParseError(err)) {
      error = new AppError('VALIDATION', 400, "The request body isn't valid JSON.");
    } else {
      logger.error({ requestId: req.id, err }, 'unhandled error');
      error = new AppError('INTERNAL', 500, `Something failed on the server (request ${req.id}).`);
    }
    const body: ErrorEnvelope = {
      error: {
        code: error.code,
        message: error.message,
        ...(error.details === undefined ? {} : { details: error.details }),
      },
    };
    res.status(error.status).json(body);
  };
}

function isBodyParseError(err: unknown): boolean {
  return (
    typeof err === 'object' && err !== null && 'type' in err && err.type === 'entity.parse.failed'
  );
}
