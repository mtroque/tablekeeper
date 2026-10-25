import { CampaignParamsSchema, PutCampaignRequestSchema } from '@tablekeeper/core';
import { Router } from 'express';

import type { SupabaseClients } from '../db/client';
import { unauthenticated } from '../errors';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { getCampaign, putCampaign } from '../services/campaigns';

export function campaignsRouter(clients: SupabaseClients): Router {
  const router = Router();
  const auth = requireAuth(clients);

  router.get(
    '/campaigns/:gameId',
    auth,
    validate({ params: CampaignParamsSchema }),
    async (req, res) => {
      if (!req.auth) throw unauthenticated();
      res.json(await getCampaign(req.auth, req.params.gameId));
    },
  );

  router.put(
    '/campaigns/:gameId',
    auth,
    validate({ params: CampaignParamsSchema, body: PutCampaignRequestSchema }),
    async (req, res) => {
      if (!req.auth) throw unauthenticated();
      res.json(await putCampaign(req.auth, req.params.gameId, req.body));
    },
  );

  return router;
}
