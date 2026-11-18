import { z } from 'zod';

export const SEVERITIES = ['critical', 'high', 'moderate', 'low'] as const;
export type AuditCounts = Record<(typeof SEVERITIES)[number], number>;

const AuditSchema = z.object({
  metadata: z.object({
    vulnerabilities: z.object({
      critical: z.number().default(0),
      high: z.number().default(0),
      moderate: z.number().default(0),
      low: z.number().default(0),
    }),
  }),
});

/** Counts from `pnpm audit --prod --json`, or undefined when the output isn't an audit report. */
export function parseAuditCounts(json: string): AuditCounts | undefined {
  try {
    const parsed = AuditSchema.safeParse(JSON.parse(json));
    return parsed.success ? parsed.data.metadata.vulnerabilities : undefined;
  } catch {
    return undefined;
  }
}

export function formatAuditLine(counts: AuditCounts | undefined): string {
  if (!counts) return 'Production advisories: audit unavailable (offline or pnpm audit failed)';
  const parts = SEVERITIES.map((severity) => `${counts[severity]} ${severity}`);
  return `Production advisories (pnpm audit --prod): ${parts.join(', ')}`;
}
