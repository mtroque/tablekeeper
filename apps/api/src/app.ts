import express, { type Express } from 'express';
import type { Logger } from 'pino';

import type { Config } from './config';
import { createSupabaseClients, type SupabaseClients } from './db/client';
import { createLlm } from './llm/setup';
import { createLogger } from './logger';
import { cors } from './middleware/cors';
import { errorHandler, notFoundRoute } from './middleware/errors';
import { burstLimit } from './middleware/rate-limit';
import { requestId } from './middleware/request-id';
import { campaignsRouter } from './routes/campaigns';
import { gamesRouter } from './routes/games';
import { healthRouter } from './routes/health';
import { meRouter } from './routes/me';
import { quotaRouter } from './routes/quota';
import { rulesRouter } from './routes/rules';
import { sessionsRouter } from './routes/sessions';

export type AppDeps = { logger?: Logger; clients?: SupabaseClients };

/** The Express app without `listen`, so tests can drive it with Supertest. */
export function createApp(config: Config, deps: AppDeps = {}): Express {
  const logger = deps.logger ?? createLogger(config);
  const clients = deps.clients ?? createSupabaseClients(config.supabase);
  const llm = createLlm(config, clients, logger);

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(requestId(logger));
  app.use(cors(config.webOrigins));
  app.use(express.json({ limit: '1mb' }));

  app.use(healthRouter());

  const v1 = express.Router();
  v1.use(burstLimit(config.rateLimit));
  v1.use(gamesRouter());
  v1.use(meRouter(clients));
  v1.use(quotaRouter(config, clients, llm));
  v1.use(rulesRouter(config, clients, llm));
  v1.use(sessionsRouter(clients));
  v1.use(campaignsRouter(clients));
  app.use('/v1', v1);

  app.use(notFoundRoute);
  app.use(errorHandler(logger));
  return app;
}
