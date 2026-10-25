import type { RequestHandler } from 'express';
import type { z } from 'zod';

import { AppError } from '../errors';

type Schemas = { params?: z.ZodType; query?: z.ZodType; body?: z.ZodType };
type Out<S> = S extends z.ZodType ? z.output<S> : unknown;

/**
 * Parses params, query and body with Zod and replaces them with the parsed values,
 * or fails with `VALIDATION` and the issues as details.
 */
export function validate<S extends Schemas>(
  schemas: S,
): RequestHandler<Out<S['params']>, unknown, Out<S['body']>, Out<S['query']>> {
  return (req, _res, next) => {
    const issues: Array<{ in: string; path: string; message: string }> = [];
    for (const part of ['params', 'query', 'body'] as const) {
      const schema = schemas[part];
      if (!schema) continue;
      const result = schema.safeParse(req[part]);
      if (!result.success) {
        for (const issue of result.error.issues) {
          issues.push({ in: part, path: issue.path.join('.'), message: issue.message });
        }
        continue;
      }
      // Express 5 exposes `query` as a getter, so define the parsed value instead of assigning it.
      Object.defineProperty(req, part, { value: result.data, writable: true, configurable: true });
    }
    if (issues.length > 0) {
      throw new AppError('VALIDATION', 400, 'Some fields are invalid.', { issues });
    }
    next();
  };
}
