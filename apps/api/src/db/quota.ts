import { z } from 'zod';

import type { Db } from './client';

export type SubjectType = 'user' | 'ip';
export type Subject = { type: SubjectType; key: string };

/** Which limit stopped a request, or null when it was counted. */
export type ConsumeResult = null | 'global' | 'subject';

const ConsumeResultSchema = z.enum(['global', 'subject']).nullable();

/** Today's date in UTC, as stored in `llm_usage.day`. */
export function utcDay(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** One SQL statement per limit, so concurrent requests can't overshoot (see the migration). */
export async function consumeRequest(
  db: Db,
  subject: Subject,
  limits: { subject: number; globalRequests: number; globalTokens: number },
): Promise<ConsumeResult> {
  const { data, error } = await db.rpc('llm_consume_request', {
    p_subject_type: subject.type,
    p_subject_key: subject.key,
    p_subject_limit: limits.subject,
    p_global_requests: limits.globalRequests,
    p_global_tokens: limits.globalTokens,
  });
  if (error) throw error;
  return ConsumeResultSchema.parse(data);
}

export async function recordTokens(
  db: Db,
  subject: Subject,
  usage: { inputTokens: number; outputTokens: number },
): Promise<void> {
  const { error } = await db.rpc('llm_record_tokens', {
    p_subject_type: subject.type,
    p_subject_key: subject.key,
    p_input: usage.inputTokens,
    p_output: usage.outputTokens,
  });
  if (error) throw error;
}

/** Requests counted today for a subject. */
export async function requestsToday(db: Db, subject: Subject): Promise<number> {
  const { data, error } = await db
    .from('llm_usage')
    .select('requests')
    .eq('subject_type', subject.type)
    .eq('subject_key', subject.key)
    .eq('day', utcDay())
    .maybeSingle();
  if (error) throw error;
  return data?.requests ?? 0;
}
