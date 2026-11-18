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
