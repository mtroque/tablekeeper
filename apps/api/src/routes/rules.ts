import { RulesAskParamsSchema, RulesAskRequestSchema } from '@tablekeeper/core';
import { Router } from 'express';

import type { Config } from '../config';
import type { SupabaseClients } from '../db/client';
import type { Llm } from '../llm/setup';
import { optionalAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { subjectFor } from '../services/quota';
import { askRules } from '../services/rules';

export function rulesRouter(config: Config, clients: SupabaseClients, llm: Llm): Router {
  const router = Router();
  router.post(
    '/games/:gameId/rules/ask',
    optionalAuth(clients),
    validate({ params: RulesAskParamsSchema, body: RulesAskRequestSchema }),
    async (req, res) => {
      const answer = await askRules(
        { config, service: clients.service, gateway: llm.gateway, quotas: llm.quotas },
        {
          gameId: req.params.gameId,
          question: req.body.question,
          history: req.body.history,
          subject: subjectFor(req, config),
        },
      );
      res.json(answer);
    },
  );
  return router;
}
