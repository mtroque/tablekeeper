// pnpm rules:smoke <gameId> "<question>"
// One real rules-assistant call through the API's gateway and quotas (LLM_PROVIDER from the
// environment, so it calls Anthropic unless set to fake). Counted as a guest named rules-smoke.
import { loadConfig } from '../apps/api/src/config';
import { createSupabaseClients } from '../apps/api/src/db/client';
import { createLlm } from '../apps/api/src/llm/setup';
import { createLogger } from '../apps/api/src/logger';
import { askRules } from '../apps/api/src/services/rules';
// The API's `req.auth` typing, which the root tsconfig doesn't otherwise see.
import type {} from '../apps/api/src/types/express';

import { loadLocalEnv } from './lib/local-env.mjs';

const [gameId, question] = process.argv.slice(2);
if (!gameId || !question) {
  console.error('Usage: pnpm rules:smoke <gameId> "<question>"');
  process.exit(1);
}

await loadLocalEnv();
const config = loadConfig({ ...process.env, LOG_LEVEL: process.env.LOG_LEVEL ?? 'warn' });
const clients = createSupabaseClients(config.supabase);
const llm = createLlm(config, clients, createLogger(config));
const started = performance.now();
try {
  const answer = await askRules(
    { config, service: clients.service, gateway: llm.gateway, quotas: llm.quotas },
    { gameId, question, history: [], subject: { type: 'ip', key: 'rules-smoke' } },
  );
  console.log(`Provider: ${llm.provider.name}  (${Math.round(performance.now() - started)} ms)`);
  console.log(`\n${answer.answer}\n`);
  console.log(`notCovered: ${answer.notCovered}`);
  for (const c of answer.citations) {
    console.log(`  § ${c.title} · printed p. ${c.printedPages ?? 'none'} · ${c.url}`);
  }
  console.log(`Quota: ${answer.quota.remaining} of ${answer.quota.limit} left today`);
} catch (error) {
  console.error(error instanceof Error ? `${error.name}: ${error.message}` : error);
  process.exit(1);
}
