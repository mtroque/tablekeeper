import type { Db } from '../db/client';
import {
  consumeRequest,
  recordTokens,
  requestsToday,
  type ConsumeResult,
  type Subject,
} from '../db/quota';

import type { Usage } from './types';

export type QuotaLimits = { subject: number; globalRequests: number; globalTokens: number };

/** Daily LLM usage per subject and in total, kept in `llm_usage`. */
export interface QuotaStore {
  /** Counts one request unless a limit is reached; says which one stopped it. */
  consume(subject: Subject, limits: QuotaLimits): Promise<ConsumeResult>;
  recordTokens(subject: Subject, usage: Usage): Promise<void>;
  used(subject: Subject): Promise<number>;
}

export function createDbQuotaStore(service: Db): QuotaStore {
  return {
    consume: (subject, limits) => consumeRequest(service, subject, limits),
    recordTokens: (subject, usage) => recordTokens(service, subject, usage),
    used: (subject) => requestsToday(service, subject),
  };
}
