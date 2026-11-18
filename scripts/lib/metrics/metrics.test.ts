import { describe, expect, it } from 'vitest';

import { parseBaselineEntries } from './baseline';
import { countCorrections } from './corrections';
import { formatMetricsReport } from './format';
import { bucketByWeek, extractRevertedPrs, isoWeek } from './reverts';
import type { MergedPr } from './types';

describe('isoWeek', () => {
  it('computes ISO week strings in UTC', () => {
    expect(isoWeek('2026-11-18T12:00:00Z')).toBe('2026-W47');
    expect(isoWeek('2026-11-09T00:00:00Z')).toBe('2026-W46');
  });
});

describe('extractRevertedPrs', () => {
  const prs: MergedPr[] = [
    {
      number: 10,
      title: 'feat(web): add score card',
      headRefName: 'slice/S1',
      mergedAt: '2026-11-17T10:00:00Z',
      mergeCommitSha: 'abcdef1234567890',
      labels: [],
      reviewRounds: null,
      firstPushPassed: true,
    },
    {
      number: 11,
      title: 'Revert "feat(web): add score card" (#10)',
      headRefName: 'revert-10',
      mergedAt: '2026-11-17T12:00:00Z',
      mergeCommitSha: '1111111222222222',
      labels: [],
      reviewRounds: null,
      firstPushPassed: true,
    },
    {
      number: 12,
      title: 'feat(api): add quota',
      headRefName: 'factory/12-quota',
      mergedAt: '2026-11-18T08:00:00Z',
      mergeCommitSha: '9999999888888888',
      labels: [],
      reviewRounds: 1,
      firstPushPassed: false,
    },
  ];

  it('detects revert PRs and git revert commits, ignoring unrelated mentions', () => {
    const reverted = extractRevertedPrs(
      [
        {
          sha: '2222222',
          subject: 'Revert "feat(api): add quota"',
          body: 'This reverts commit 9999999888888888.',
        },
        {
          sha: '3333333',
          subject: 'docs(roadmap): explain revert rate',
          body: 'Notes on how revert rate is measured.',
        },
      ],
      prs,
    );

    expect([...reverted].sort((a, b) => a - b)).toEqual([10, 12]);
  });

  it('buckets PRs and revert rates by ISO week', () => {
    const reverted = new Set([10]);
    const weeks = bucketByWeek(['2026-W47', '2026-W46'], prs, reverted);
    expect(weeks[0]).toMatchObject({
      week: '2026-W47',
      merged: 3,
      factoryMerged: 1,
      reverts: 1,
    });
    expect(weeks[0]?.revertRate).toBeCloseTo(1 / 3);
    expect(weeks[0]?.ciFirstPassRate).toBeCloseTo(2 / 3);
    expect(weeks[1]).toMatchObject({
      week: '2026-W46',
      merged: 0,
      revertRate: null,
    });
  });
});

describe('countCorrections', () => {
  it('counts patterns and flags open patterns with count >= 2', () => {
    const sample = [
      '| Date | Pattern | Where | What was wrong | Correction | Source | Status |',
      '|---|---|---|---|---|---|---|',
      '| 2026-11-15 | `alpha` | a | x | y | self | open |',
      '| 2026-11-16 | `alpha` | b | x | y | trace | open |',
      '| 2026-11-16 | `beta` | a | x | y | self | promoted: rule |',
      '| 2026-11-17 | `beta` | b | x | y | self | promoted: rule |',
      '| 2026-11-17 | `gamma` | a | x | y | self | open |',
    ].join('\n');

    expect(countCorrections(sample)).toEqual([
      { pattern: 'alpha', count: 2, hardenCandidate: true },
      { pattern: 'beta', count: 2, hardenCandidate: false },
      { pattern: 'gamma', count: 1, hardenCandidate: false },
    ]);
  });
});

describe('parseBaselineEntries & formatMetricsReport', () => {
  it('parses baseline entries and formats the report', () => {
    const entries = parseBaselineEntries(
      JSON.stringify({ 'rules/no-raw-colors': { 'apps/web/src/a.tsx': 2 } }),
    );
    expect(entries).toEqual([
      { ruleId: 'rules/no-raw-colors', file: 'apps/web/src/a.tsx', count: 2 },
    ]);
    const report = formatMetricsReport({
      weeks: [],
      baselineEntries: entries,
      corrections: [{ pattern: 'alpha', count: 2, hardenCandidate: true }],
    });
    expect(report).toContain('Lint baseline entries:** 1 (2 total violations)');
    expect(report).toContain('alpha (2)');
  });
});
