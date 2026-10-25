import { z } from 'zod';

/** Rules questions left today for the caller (a guest by IP, or a signed-in user). */
export const QuotaSchema = z.object({
  /** False when the rules assistant is switched off (`LLM_ENABLED=false`). */
  enabled: z.boolean(),
  subject: z.enum(['guest', 'user']),
  limit: z.number().int().nonnegative(),
  used: z.number().int().nonnegative(),
  remaining: z.number().int().nonnegative(),
  /** ISO 8601, the next UTC midnight. */
  resetsAt: z.iso.datetime(),
});
export type Quota = z.infer<typeof QuotaSchema>;

export const QuotaResponseSchema = QuotaSchema;
export type QuotaResponse = z.infer<typeof QuotaResponseSchema>;
