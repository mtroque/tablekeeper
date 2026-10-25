import { ERROR_STATUS, type ErrorCode } from '@tablekeeper/core';

/** An expected failure, formatted into the error envelope by the error middleware. */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details: unknown;

  constructor(
    code: ErrorCode,
    status: number = ERROR_STATUS[code],
    message: string,
    details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export const unauthenticated = () => new AppError('UNAUTHENTICATED', 401, 'Sign in to do this.');
export const notFound = (what = 'That') => new AppError('NOT_FOUND', 404, `${what} wasn't found.`);
