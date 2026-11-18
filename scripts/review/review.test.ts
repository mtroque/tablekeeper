import { describe, expect, it } from 'vitest';

import {
  applyVerdictGate,
  countReviewRounds,
  hasBlockingFindings,
  REVIEW_MARKER,
  ReviewFindingsSchema,
  shouldSkipReviewForCommit,
  type PrReviewRecord,
} from './findings';
import {
  buildReviewPayload,
  extractSessionIdFromPrBody,
  parseDiffLines,
  postReviewWithFallback,
} from './post';

const VALID_RESULT = {
  findings: [
    {
      file: 'apps/api/src/routes/sessions.ts',
      line: 12,
      severity: 'should-fix' as const,
      summary: 'Missing Zod check on query param',
      failureScenario: 'Malformed query throws 500 instead of 400',
    },
    {
      file: 'README.md',
      line: 99,
      severity: 'nit' as const,
      summary: 'Wordy sentence',
      failureScenario: 'Slightly harder to scan',
    },
  ],
  verdict: {
    risk: 'medium' as const,
    confidence: 0.85,
    recommendation: 'fix' as const,
    reasons: ['One unvalidated input'],
  },
};

describe('ReviewFindingsSchema & severity', () => {
  it('validates findings and rejects invalid outputs', () => {
    expect(ReviewFindingsSchema.parse(VALID_RESULT)).toEqual(VALID_RESULT);
    expect(() =>
      ReviewFindingsSchema.parse({ findings: [], verdict: { risk: 'extreme' } }),
    ).toThrow();
  });

  it('checks blocking severity thresholds', () => {
    expect(hasBlockingFindings(VALID_RESULT.findings, 'should-fix')).toBe(true);
    expect(hasBlockingFindings(VALID_RESULT.findings, 'blocking')).toBe(false);
    expect(hasBlockingFindings([VALID_RESULT.findings[1]!], 'should-fix')).toBe(false);
  });

  it('counts factory review rounds and skips already-reviewed head commits', () => {
    const reviews: PrReviewRecord[] = [
      { commitId: 'aaa', body: 'human comment', authorLogin: 'owner' },
      { commitId: 'bbb', body: `${REVIEW_MARKER}\nround 1`, authorLogin: 'bot' },
      { commitId: 'ccc', body: `${REVIEW_MARKER}\nround 2`, authorLogin: 'bot' },
    ];
    expect(countReviewRounds(reviews)).toBe(2);
    expect(shouldSkipReviewForCommit(reviews, 'ccc')).toBe(true);
    expect(shouldSkipReviewForCommit(reviews, 'ddd')).toBe(false);
  });
});

describe('buildReviewPayload & extractSessionIdFromPrBody', () => {
  it('places in-diff findings in inline comments and out-of-diff findings in the body', () => {
    const diff = [
      '+++ b/apps/api/src/routes/sessions.ts',
      '@@ -10,0 +11,3 @@',
      '+line 11',
      '+line 12',
    ].join('\n');
    const diffLines = parseDiffLines(diff);
    const payload = buildReviewPayload(VALID_RESULT, diffLines);

    expect(payload.comments).toHaveLength(1);
    expect(payload.comments[0]).toMatchObject({
      path: 'apps/api/src/routes/sessions.ts',
      line: 12,
    });
    expect(payload.body).toContain('README.md:99');
    expect(payload.body).toContain('Verdict: `fix`');
  });

  it('extracts session id from PR body when present', () => {
    expect(extractSessionIdFromPrBody('- Runner: `claude-actions`\n- Session: `sess-123`')).toBe(
      'sess-123',
    );
    expect(extractSessionIdFromPrBody('- Session: `<session-id>`')).toBeNull();
  });

  it('falls back to body-only review when GitHub returns 422 on inline comments', () => {
    const diffLines = parseDiffLines(
      '+++ b/apps/api/src/routes/sessions.ts\n@@ -10,0 +11,3 @@\n+a\n+b',
    );
    const calls: number[] = [];
    postReviewWithFallback(
      (payload) => {
        calls.push(payload.comments.length);
        if (payload.comments.length > 0) {
          throw new Error('gh: Unprocessable Entity (HTTP 422): Line could not be resolved');
        }
      },
      VALID_RESULT,
      diffLines,
    );
    expect(calls).toEqual([1, 0]);
  });
});

describe('applyVerdictGate', () => {
  const verdict = (recommendation: 'merge' | 'fix' | 'escalate') => ({
    ...VALID_RESULT,
    verdict: { ...VALID_RESULT.verdict, recommendation },
  });

  it('turns merge into fix when a finding is at or above the blocking severity', () => {
    const gated = applyVerdictGate(verdict('merge'), 'should-fix');
    expect(gated.verdict.recommendation).toBe('fix');
    expect(gated.verdict.reasons[0]).toMatch(/Changed from `merge`: 1 finding at `should-fix`/);
  });

  it('keeps merge when only lower findings remain', () => {
    expect(applyVerdictGate(verdict('merge'), 'blocking').verdict.recommendation).toBe('merge');
  });

  it('keeps escalate', () => {
    expect(applyVerdictGate(verdict('escalate'), 'should-fix').verdict.recommendation).toBe(
      'escalate',
    );
  });
});
