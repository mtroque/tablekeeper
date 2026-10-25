import type { RequestHandler } from 'express';

/** Allows the configured web origins only. */
export function cors(origins: readonly string[]): RequestHandler {
  const allowed = new Set(origins);
  return (req, res, next) => {
    const origin = req.get('origin');
    if (origin && allowed.has(origin)) {
      res.setHeader('access-control-allow-origin', origin);
      res.setHeader('access-control-allow-headers', 'authorization, content-type, x-request-id');
      res.setHeader('access-control-allow-methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
      res.setHeader('access-control-expose-headers', 'x-request-id');
      res.setHeader('access-control-max-age', '600');
    }
    res.vary('origin');
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  };
}
