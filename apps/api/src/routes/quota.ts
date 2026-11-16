import type { QuotaResponse } from '@tablekeeper/core';
import { Router } from 'express';

import type { Config } from '../config';
import type { Clients } from '../db/client';
import type { Llm } from '../llm/setup';
import { optionalAuth } from '../middleware/auth';
import { getQuota, subjectFor } from '../services/quota';

export function quotaRouter(config: Config, clients: Clients, llm: Llm): Router {
  const router = Router();
  router.get('/me/quota', optionalAuth(clients), async (req, res) => {
    const body: QuotaResponse = await getQuota(config, llm.quotas, subjectFor(req, config));
    res.json(body);
  });
  return router;
}
