import { z } from 'zod';

export const FindingSeveritySchema = z.enum(['blocking', 'should-fix', 'nit']);
export type FindingSeverity = z.infer<typeof FindingSeveritySchema>;

export const ReviewFindingSchema = z.object({
  file: z.string().min(1),
  line: z.int().min(1),
  severity: FindingSeveritySchema,
  summary: z.string().min(1),
  failureScenario: z.string().min(1),
});
export type ReviewFinding = z.infer<typeof ReviewFindingSchema>;

export const ReviewVerdictSchema = z.object({
  risk: z.enum(['low', 'medium', 'high']),
  confidence: z.number().min(0).max(1),
  recommendation: z.enum(['merge', 'fix', 'escalate']),
  reasons: z.array(z.string().min(1)).min(1),
});
export type ReviewVerdict = z.infer<typeof ReviewVerdictSchema>;

export const ReviewFindingsSchema = z.object({
  findings: z.array(ReviewFindingSchema),
  verdict: ReviewVerdictSchema,
});
export type ReviewFindings = z.infer<typeof ReviewFindingsSchema>;

const SEVERITY_RANK: Record<FindingSeverity, number> = {
  blocking: 3,
  'should-fix': 2,
  nit: 1,
};

export function hasBlockingFindings(
  findings: readonly ReviewFinding[],
  blockingSeverity: FindingSeverity = 'should-fix',
): boolean {
  const threshold = SEVERITY_RANK[blockingSeverity];
  return findings.some((f) => SEVERITY_RANK[f.severity] >= threshold);
}

/**
 * The posted verdict follows the gate: with a finding at or above `blockingSeverity`, a `merge`
 * from the model becomes `fix`, with a reason saying so. `escalate` is kept.
 */
export function applyVerdictGate(
  result: ReviewFindings,
  blockingSeverity: FindingSeverity = 'should-fix',
): ReviewFindings {
  if (result.verdict.recommendation !== 'merge') return result;
  const threshold = SEVERITY_RANK[blockingSeverity];
  const blocking = result.findings.filter((f) => SEVERITY_RANK[f.severity] >= threshold).length;
  if (blocking === 0) return result;
  return {
    ...result,
    verdict: {
      ...result.verdict,
      recommendation: 'fix',
      reasons: [
        `Changed from \`merge\`: ${blocking} finding${blocking === 1 ? '' : 's'} at \`${blockingSeverity}\` or above block merging.`,
        ...result.verdict.reasons,
      ],
    },
  };
}

export type PrReviewRecord = {
  commitId: string | null;
  body: string;
  authorLogin: string | null;
};

export const REVIEW_MARKER = '<!-- tablekeeper-factory-review -->';

export function isFactoryReview(review: PrReviewRecord): boolean {
  return review.body.includes(REVIEW_MARKER);
}

export function shouldSkipReviewForCommit(
  reviews: readonly PrReviewRecord[],
  headSha: string,
): boolean {
  return reviews.some((r) => isFactoryReview(r) && r.commitId === headSha);
}

export function countReviewRounds(reviews: readonly PrReviewRecord[]): number {
  return reviews.filter(isFactoryReview).length;
}
