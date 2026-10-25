import { Router } from 'express';

import type { SupabaseClients } from '../db/client';
import { unauthenticated } from '../errors';
import { requireAuth } from '../middleware/auth';
import { getMe } from '../services/me';

export function meRouter(clients: SupabaseClients): Router {
  const router = Router();
  router.get('/me', requireAuth(clients), async (req, res) => {
    if (!req.auth) throw unauthenticated();
    res.json(await getMe(req.auth));
  });
  return router;
}
