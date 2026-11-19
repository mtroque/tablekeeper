import { z } from 'zod';

const GradeMetricsSchema = z.object({
  week: z.string(),
  sessions: z.number(),
  toolCalls: z.number(),
  failed: z.number(),
  byClass: z.record(z.string(), z.number()),
});

export type TraceWeek = z.infer<typeof GradeMetricsSchema>;

const BLOCK_RE = /<!-- grade-metrics (\{.*?\}) -->/;

/** Reads the hidden `grade-metrics` block a "Grading report <week>" issue carries (W16). */
export function parseGradeMetrics(body: string): TraceWeek | null {
  const json = BLOCK_RE.exec(body)?.[1];
  if (!json) return null;
  try {
    const parsed = GradeMetricsSchema.safeParse(JSON.parse(json));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Failed tool calls per session and the top failure classes, for the weekly metrics table. */
export function traceColumns(trace: TraceWeek | undefined): { perSession: string; top: string } {
  if (!trace) return { perSession: '-', top: '-' };
  const perSession = trace.sessions > 0 ? (trace.failed / trace.sessions).toFixed(1) : '-';
  const top = Object.entries(trace.byClass)
    .filter(([cls]) => cls !== 'check-failed')
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 3)
    .map(([cls, n]) => `${cls} ${n}`)
    .join(', ');
  return { perSession, top: top || '-' };
}
