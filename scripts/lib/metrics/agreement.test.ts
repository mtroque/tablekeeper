import { describe, expect, it } from 'vitest';

import {
  formatDecisionComment,
  type DecisionEntry,
  type MergeDecision,
} from '../../factory/merge-policy';

import { formatShadowAgreement, shadowResult, type ShadowPr } from './agreement';

const DECISION: MergeDecision = {
  decision: 'merge',
  mode: 'shadow',
  groups: ['docs'],
  changedLines: 3,
  reasons: [],
};

function comment(history: DecisionEntry[]): string {
  return formatDecisionComment({ decision: DECISION, history });
}

function entry(sha: string, decision: 'merge' | 'escalate', groups = ['docs']): DecisionEntry {
  return { sha, decision, mode: 'shadow', groups, at: '2026-11-16T00:00:00Z' };
}

function pr(overrides: Partial<ShadowPr>): ShadowPr {
  return {
    number: 1,
    state: 'MERGED',
    headSha: 'a1',
    closedAt: '2026-11-17T10:00:00Z',
    comments: [comment([entry('a1', 'merge')])],
    ...overrides,
  };
}

describe('shadowResult', () => {
  it('merge agrees with a merge at the same commit', () => {
    expect(shadowResult(pr({}))).toMatchObject({
      outcome: 'merged',
      agrees: true,
      week: '2026-W47',
    });
  });

  it('merge disagrees when the owner changed or closed it', () => {
    expect(shadowResult(pr({ headSha: 'b2' }))).toMatchObject({
      outcome: 'changed',
      agrees: false,
    });
    expect(shadowResult(pr({ state: 'CLOSED' }))).toMatchObject({
      outcome: 'closed',
      agrees: false,
    });
  });

  it('escalate agrees with a change or a close, not with a merge as is', () => {
    const escalated = [comment([entry('a1', 'escalate')])];
    expect(shadowResult(pr({ comments: escalated, headSha: 'b2' }))?.agrees).toBe(true);
    expect(shadowResult(pr({ comments: escalated, state: 'CLOSED' }))?.agrees).toBe(true);
    expect(shadowResult(pr({ comments: escalated }))?.agrees).toBe(false);
  });

  it('uses the first shadow decision, ignoring live ones', () => {
    const history = [
      { ...entry('a0', 'escalate'), mode: 'escalate' as const },
      entry('a1', 'merge'),
      entry('b2', 'escalate'),
    ];
    expect(shadowResult(pr({ comments: [comment(history)] }))).toMatchObject({
      decision: 'merge',
      agrees: true,
    });
  });

  it('skips open PRs and PRs without a shadow decision', () => {
    expect(shadowResult(pr({ state: 'OPEN', closedAt: null }))).toBeNull();
    expect(shadowResult(pr({ comments: ['lgtm'] }))).toBeNull();
  });
});

describe('formatShadowAgreement', () => {
  it('reports agreement per week and per group', () => {
    const prs = [
      pr({ number: 1 }),
      pr({
        number: 2,
        headSha: 'zz',
        comments: [comment([entry('a1', 'merge', ['docs', 'tooling'])])],
      }),
      pr({ number: 3, closedAt: '2026-11-09T00:00:00Z' }),
    ];
    const report = formatShadowAgreement(['2026-W47', '2026-W46', '2026-W45'], prs);
    expect(report).toContain('2/3 (67%) agree overall');
    expect(report).toContain('| 2026-W47 | 1/2 (50%) |');
    expect(report).toContain('| 2026-W46 | 1/1 (100%) |');
    expect(report).toContain('| 2026-W45 | - |');
    expect(report).toContain('| `docs` | 2/3 (67%) |');
    expect(report).toContain('| `tooling` | 0/1 (0%) |');
  });

  it('shows dashes with no decisions yet', () => {
    const report = formatShadowAgreement(['2026-W47'], []);
    expect(report).toContain('- agree overall');
    expect(report).toContain('| - | - |');
  });
});
