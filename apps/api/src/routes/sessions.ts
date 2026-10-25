import {
  ListSessionsQuerySchema,
  PatchSessionRequestSchema,
  SaveSessionRequestSchema,
  SessionIdParamsSchema,
} from '@tablekeeper/core';
import { Router } from 'express';

import type { SupabaseClients } from '../db/client';
import { unauthenticated } from '../errors';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { getSession, listSessions, patchSession, saveSession } from '../services/sessions';

export function sessionsRouter(clients: SupabaseClients): Router {
  const router = Router();
  const auth = requireAuth(clients);

  router.get('/sessions', auth, validate({ query: ListSessionsQuerySchema }), async (req, res) => {
    if (!req.auth) throw unauthenticated();
    res.json(await listSessions(req.auth, req.query.gameId, req.query.cursor));
  });

  router.post('/sessions', auth, validate({ body: SaveSessionRequestSchema }), async (req, res) => {
    if (!req.auth) throw unauthenticated();
    res.status(201).json(await saveSession(req.auth, req.body));
  });

  router.get(
    '/sessions/:id',
    auth,
    validate({ params: SessionIdParamsSchema }),
    async (req, res) => {
      if (!req.auth) throw unauthenticated();
      res.json(await getSession(req.auth, req.params.id));
    },
  );

  router.patch(
    '/sessions/:id',
    auth,
    validate({ params: SessionIdParamsSchema, body: PatchSessionRequestSchema }),
    async (req, res) => {
      if (!req.auth) throw unauthenticated();
      res.json(await patchSession(req.auth, req.params.id, req.body));
    },
  );

  return router;
}
