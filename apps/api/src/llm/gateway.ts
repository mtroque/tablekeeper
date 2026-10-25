import type { Logger } from 'pino';

import type { Config } from '../config';
import type { Subject } from '../db/quota';
import { AppError } from '../errors';

import type { QuotaStore } from './quota-store';
import type { CompletionRequest, CompletionResponse, LlmProvider } from './types';

/** What a model call is for; one per feature that uses the LLM. */
export type LlmPurpose = 'rules';

export type RunLimits = { timeoutMs: number };

/** The model as a `gateway.run` callback sees it: calls are timed, capped and recorded. */
export type GatewayModel = {
  complete(request: Omit<CompletionRequest, 'signal'>): Promise<CompletionResponse>;
};

export type GatewayDeps = {
  config: Config;
  provider: LlmProvider;
  quotas: QuotaStore;
  logger: Logger;
};

export type Gateway = ReturnType<typeof createGateway>;

const timedOut = () =>
  new AppError('INTERNAL', 504, 'The answer took too long. Try a shorter question.');

export const llmDisabled = () =>
  new AppError('LLM_DISABLED', 503, 'Rules answers are switched off right now.');

/** The daily request limit for a subject. */
export function subjectLimit(config: Config, subject: Subject): number {
  return subject.type === 'user'
    ? config.quotas.userDailyRequests
    : config.quotas.guestDailyRequests;
}

/**
 * The only way to call a model (docs/ARCHITECTURE.md → LLM gateway and abuse protection):
 * kill switch, global budget, per-subject quota, then the callback's model calls, each one
 * recorded in `llm_usage`, all within `limits.timeoutMs`. One `run` is one request of quota.
 */
export function createGateway({ config, provider, quotas, logger }: GatewayDeps) {
  return {
    async run<T>(
      options: { purpose: LlmPurpose; subject: Subject; limits: RunLimits },
      work: (model: GatewayModel) => Promise<T>,
    ): Promise<T> {
      const { purpose, subject, limits } = options;
      if (!config.llm.enabled) throw llmDisabled();

      const stoppedBy = await quotas.consume(subject, {
        subject: subjectLimit(config, subject),
        globalRequests: config.quotas.globalDailyRequests,
        globalTokens: config.quotas.globalDailyTokens,
      });
      if (stoppedBy === 'global') {
        throw new AppError(
          'QUOTA_EXCEEDED',
          429,
          'Rules answers have reached their limit for today. Try again tomorrow.',
          { scope: 'global' },
        );
      }
      if (stoppedBy === 'subject') {
        throw new AppError('QUOTA_EXCEEDED', 429, 'No rules questions left today.', {
          scope: subject.type === 'user' ? 'user' : 'guest',
        });
      }

      const controller = new AbortController();
      const timer = setTimeout(() => {
        controller.abort();
      }, limits.timeoutMs);
      // A function, so each check reads the signal now rather than a narrowed earlier value.
      const timedOutNow = () => controller.signal.aborted;
      const model: GatewayModel = {
        complete: async (request) => {
          if (timedOutNow()) throw timedOut();
          let response: CompletionResponse | undefined;
          try {
            response = await provider.complete({ ...request, signal: controller.signal });
            return response;
          } catch (error) {
            if (timedOutNow()) throw timedOut();
            logger.error({ err: error, purpose, provider: provider.name }, 'llm call failed');
            throw new AppError('INTERNAL', 502, "Couldn't get an answer right now. Try again.");
          } finally {
            // Recorded even when the call failed: the request was already counted.
            await quotas
              .recordTokens(subject, response?.usage ?? { inputTokens: 0, outputTokens: 0 })
              .catch((err: unknown) => {
                logger.error({ err, purpose }, 'llm usage not recorded');
              });
          }
        },
      };
      try {
        return await work(model);
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
