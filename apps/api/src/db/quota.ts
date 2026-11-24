import { z } from 'zod';

import type { Db } from './client';
import type { LlmUsageRow } from './types';

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
  const [row] = await db<{ result: string | null }>`
    select public.llm_consume_request(
      ${subject.type},
      ${subject.key},
      ${limits.subject},
      ${limits.globalRequests},
      ${limits.globalTokens}
    ) as result
  `;
  return ConsumeResultSchema.parse(row?.result ?? null);
}

export async function refundRequest(db: Db, subject: Subject): Promise<void> {
  await db`select public.llm_refund_request(${subject.type}, ${subject.key})`;
}

export async function recordTokens(
  db: Db,
  subject: Subject,
  usage: { inputTokens: number; outputTokens: number },
): Promise<void> {
  await db`
    select public.llm_record_tokens(
      ${subject.type},
      ${subject.key},
      ${usage.inputTokens},
      ${usage.outputTokens}
    )
  `;
}

/** Requests counted today for a subject. */
export async function requestsToday(db: Db, subject: Subject): Promise<number> {
  const [row] = await db<Pick<LlmUsageRow, 'requests'>>`
    select requests
    from public.llm_usage
    where subject_type = ${subject.type}
      and subject_key = ${subject.key}
      and day = ${utcDay()}::date
  `;
  return row?.requests ?? 0;
}
