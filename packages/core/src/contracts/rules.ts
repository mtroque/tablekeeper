import { z } from 'zod';

import { QuotaSchema } from './quota';

export const RULES_QUESTION_MAX_LENGTH = 500;
/** Earlier turns sent with a question as context. */
export const RULES_HISTORY_MAX_TURNS = 6;

export const RulesTurnSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().trim().min(1).max(4000),
});
export type RulesTurn = z.infer<typeof RulesTurnSchema>;

/** Any id: unknown games and games without a loaded rulebook are both `NOT_FOUND`. */
export const RulesAskParamsSchema = z.object({ gameId: z.string().min(1).max(64) });

export const RulesAskRequestSchema = z.object({
  question: z.string().trim().min(1).max(RULES_QUESTION_MAX_LENGTH),
  history: z.array(RulesTurnSchema).max(RULES_HISTORY_MAX_TURNS).default([]),
});
export type RulesAskRequest = z.input<typeof RulesAskRequestSchema>;

export const CitationSchema = z.object({
  sectionId: z.uuid(),
  title: z.string(),
  /** The page number printed in the rulebook ("4", "4 and 5"); null when none is printed. */
  printedPages: z.string().nullable(),
  /** The PDF page the link opens. */
  pdfPage: z.number().int().positive(),
  /** The publisher's PDF at `#page=<pdfPage>`. */
  url: z.url(),
});
export type Citation = z.infer<typeof CitationSchema>;

export const RulesAnswerSchema = z.object({
  answer: z.string(),
  /** True when the rulebook doesn't settle the question. */
  notCovered: z.boolean(),
  citations: z.array(CitationSchema),
  quota: QuotaSchema,
});
export type RulesAnswer = z.infer<typeof RulesAnswerSchema>;
