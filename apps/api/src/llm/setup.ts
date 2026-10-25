import type { Logger } from 'pino';

import type { Config } from '../config';
import type { SupabaseClients } from '../db/client';

import { AnthropicProvider } from './anthropic-provider';
import { FakeProvider } from './fake-provider';
import { createGateway, type Gateway } from './gateway';
import { createDbQuotaStore, type QuotaStore } from './quota-store';
import type { LlmProvider } from './types';

export type Llm = { provider: LlmProvider; quotas: QuotaStore; gateway: Gateway };

/** The provider named by `LLM_PROVIDER`. */
export function createProvider(config: Config): LlmProvider {
  switch (config.llm.provider) {
    case 'fake':
      return new FakeProvider();
    case 'anthropic':
      return new AnthropicProvider({
        apiKey: config.llm.anthropicApiKey,
        model: config.llm.rulesModel,
      });
  }
}

export function createLlm(
  config: Config,
  clients: SupabaseClients,
  logger: Logger,
  provider: LlmProvider = createProvider(config),
): Llm {
  const quotas = createDbQuotaStore(clients.service);
  return { provider, quotas, gateway: createGateway({ config, provider, quotas, logger }) };
}
