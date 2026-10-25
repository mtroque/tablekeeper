import type { HealthResponse } from '@tablekeeper/core';
import { Router } from 'express';

export function healthRouter(): Router {
  const router = Router();
  router.get('/health', (_req, res) => {
    const body: HealthResponse = { ok: true };
    res.json(body);
  });
  return router;
}
