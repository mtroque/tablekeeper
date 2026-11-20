import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { buildReviewPayload } from '../review/post';

import { planActions } from './merge';
import {
  countDisputed,
  parseVerdict,
  reviewOutcome,
  revertRate,
  rollupToChecks,
  type ReviewNode,
} from './merge-github';
import {
  ALWAYS_ESCALATE_PATHS,
  appendDecision,
  decide,
  formatDecisionComment,
  groupsForPath,
  parseDecisionHistory,
  parseMergePolicy,
  REQUIRED_CHECKS,
  type CheckResult,
  type MergeMode,
  type MergePolicy,
  type PrFacts,
  type ReviewOutcome,
} from './merge-policy';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const REAL_POLICY = parseMergePolicy(
  readFileSync(join(ROOT, '.github/factory/merge-policy.json'), 'utf8'),
);

/** The checked-in policy with some groups' modes changed. */
function policyWith(modes: Record<string, MergeMode>, all?: MergeMode): MergePolicy {
  return {
    ...REAL_POLICY,
    groups: REAL_POLICY.groups.map((g) => ({ ...g, mode: modes[g.id] ?? all ?? g.mode })),
  };
}

const GREEN: CheckResult[] = REQUIRED_CHECKS.map((name) => ({ name, state: 'pass' }));
const CLEAN: ReviewOutcome = {
  status: 'done',
  recommendation: 'merge',
  risk: 'low',
  confidence: 0.9,
  openBlocking: 0,
  disputed: 0,
};

function pr(paths: string[], overrides: Partial<PrFacts> = {}): PrFacts {
  return {
    number: 7,
    headRef: 'factory/7-docs',
    headSha: 'abc123',
    labels: [],
    files: paths.map((path) => ({ path, additions: 10, deletions: 2 })),
    ...overrides,
  };
}

const DOCS = ['docs/UX.md'];
const rules = (d: ReturnType<typeof decide>) => d.reasons.map((r) => r.rule);

describe('merge policy file', () => {
  it('parses, and every group starts in shadow', () => {
    expect(REAL_POLICY.groups.map((g) => g.mode)).toEqual(REAL_POLICY.groups.map(() => 'shadow'));
    expect(REAL_POLICY.revertRateCeiling).toBe(0.02);
  });

  it('rejects duplicate group ids and unknown modes', () => {
    const base = JSON.parse(
      readFileSync(join(ROOT, '.github/factory/merge-policy.json'), 'utf8'),
    ) as {
      groups: { id: string; mode: string }[];
    };
    const dup = { ...base, groups: [...base.groups, base.groups[0]] };
    expect(() => parseMergePolicy(JSON.stringify(dup))).toThrow();
    const bad = { ...base, groups: base.groups.map((g) => ({ ...g, mode: 'yolo' })) };
    expect(() => parseMergePolicy(JSON.stringify(bad))).toThrow();
  });

  it.each([
    ['docs/ROADMAP.md', ['docs']],
    ['README.md', ['docs']],
    ['docs/games/azul.md', ['game-rules']],
    ['packages/core/src/games/azul/score.ts', ['game-rules']],
    ['apps/web/src/games/azul/board.tsx', ['game-ui-cv']],
    ['data/fixtures/patchwork/a.json', ['game-ui-cv']],
    ['packages/core/src/kit/types.ts', ['shared-code']],
    ['apps/web/src/components/counter.tsx', ['shared-code']],
    ['apps/api/src/routes/sessions.ts', ['api']],
    ['apps/api/src/llm/gateway.ts', ['llm-gateway']],
    ['apps/api/src/rules/agent.ts', ['llm-gateway']],
    ['apps/api/src/middleware/auth.ts', ['auth']],
    ['apps/web/src/app/auth/callback/page.tsx', ['shared-code', 'auth']],
    ['db/migrations/0009_x.sql', ['migrations']],
    ['scripts/metrics.ts', ['tooling']],
    ['tests/e2e/S1.spec.ts', ['tooling']],
    ['scripts/factory/merge.ts', []],
    ['package.json', ['dependencies']],
    ['apps/web/package.json', ['dependencies']],
    ['pnpm-lock.yaml', ['dependencies']],
    ['eslint.config.js', []],
  ])('%s is in %j', (path, groups) => {
    expect(groupsForPath(REAL_POLICY, path)).toEqual(groups);
  });
});

describe('decide: modes', () => {
  it('records a docs-only PR in shadow mode as merge when every rule passes', () => {
    const d = decide(REAL_POLICY, pr(DOCS), GREEN, CLEAN, 0);
    expect(d).toMatchObject({ decision: 'merge', mode: 'shadow', groups: ['docs'], reasons: [] });
  });

  it('merges a docs-only PR when docs is auto', () => {
    const d = decide(policyWith({ docs: 'auto' }), pr(DOCS), GREEN, CLEAN, 0);
    expect(d).toMatchObject({ decision: 'merge', mode: 'auto' });
  });

  it('escalates a PR that also touches shared code when only docs is auto', () => {
    const d = decide(
      policyWith({ docs: 'auto' }),
      pr([...DOCS, 'apps/web/src/components/counter.tsx']),
      GREEN,
      CLEAN,
      0,
    );
    expect(d).toMatchObject({ decision: 'escalate', mode: 'auto' });
    expect(rules(d)).toEqual(['group-shadow']);
  });

  it('strictest group wins: an escalate group escalates a PR whose other group is auto', () => {
    const d = decide(
      policyWith({ docs: 'auto', 'shared-code': 'escalate' }),
      pr([...DOCS, 'apps/web/src/components/counter.tsx']),
      GREEN,
      CLEAN,
      0,
    );
    expect(d).toMatchObject({ decision: 'escalate', mode: 'escalate' });
    expect(rules(d)).toContain('group-escalate');
  });

  it('strictest group wins: shadow beats auto only when no group is auto', () => {
    const d = decide(
      policyWith({}, 'shadow'),
      pr([...DOCS, 'scripts/metrics.ts']),
      GREEN,
      CLEAN,
      0,
    );
    expect(d.mode).toBe('shadow');
  });

  it('an unlisted file escalates, even with every group auto', () => {
    const d = decide(policyWith({}, 'auto'), pr([...DOCS, 'eslint.config.js']), GREEN, CLEAN, 0);
    expect(d).toMatchObject({ decision: 'escalate', mode: 'escalate' });
    expect(rules(d)).toEqual(['unlisted-path']);
  });

  it('a PR with no files escalates', () => {
    expect(decide(policyWith({}, 'auto'), pr([]), GREEN, CLEAN, 0).decision).toBe('escalate');
  });

  it('waits for checks and review before a soft escalation', () => {
    const d = decide(policyWith({}, 'auto'), pr(['eslint.config.js']), [], CLEAN, 0);
    expect(d.decision).toBe('wait');
    expect(rules(d)).toContain('unlisted-path');
  });
});

describe('decide: always-escalate paths', () => {
  const samples: Record<(typeof ALWAYS_ESCALATE_PATHS)[number], string> = {
    '.github/factory/**': '.github/factory/merge-policy.json',
    '.github/workflows/**': '.github/workflows/ci.yml',
    '.github/workflow-drafts/**': '.github/workflow-drafts/merge.yml',
    '.agents/skills/**': '.agents/skills/build/SKILL.md',
    '.claude/settings.json': '.claude/settings.json',
    '.claude/skills/**': '.claude/skills/review/SKILL.md',
    'AGENTS.md': 'AGENTS.md',
    'scripts/factory/**': 'scripts/factory/merge-policy.ts',
  };

  it.each(Object.entries(samples))('%s (%s) escalates with every group auto', (_pattern, path) => {
    const d = decide(policyWith({}, 'auto'), pr([...DOCS, path]), GREEN, CLEAN, 0);
    expect(d).toMatchObject({ decision: 'escalate', mode: 'escalate' });
    expect(rules(d)).toContain('always-escalate');
  });

  it('covers every pattern in ALWAYS_ESCALATE_PATHS', () => {
    expect(Object.keys(samples).sort()).toEqual([...ALWAYS_ESCALATE_PATHS].sort());
  });

  it('a PR changing only the policy file escalates with every group auto', () => {
    const d = decide(
      policyWith({}, 'auto'),
      pr(['.github/factory/merge-policy.json']),
      GREEN,
      CLEAN,
      0,
    );
    expect(d.decision).toBe('escalate');
  });
});

describe('decide: each fixed rule blocks on its own', () => {
  const auto = policyWith({ docs: 'auto' });

  it.each(REQUIRED_CHECKS)('a red %s check escalates', (name) => {
    const checks = GREEN.map((c) => (c.name === name ? { name, state: 'fail' as const } : c));
    const d = decide(auto, pr(DOCS), checks, CLEAN, 0);
    expect(d.decision).toBe('escalate');
    expect(rules(d)).toEqual(['checks']);
  });

  it.each(REQUIRED_CHECKS)('a missing or running %s check waits', (name) => {
    const missing = GREEN.filter((c) => c.name !== name);
    expect(decide(auto, pr(DOCS), missing, CLEAN, 0).decision).toBe('wait');
    const running = GREEN.map((c) => (c.name === name ? { name, state: 'pending' as const } : c));
    expect(decide(auto, pr(DOCS), running, CLEAN, 0).decision).toBe('wait');
  });

  it('a rerun that passed replaces the earlier failure', () => {
    const checks: CheckResult[] = [{ name: 'E2E', state: 'fail' }, ...GREEN];
    expect(decide(auto, pr(DOCS), checks, CLEAN, 0).decision).toBe('merge');
  });

  it('a pending review waits', () => {
    const d = decide(auto, pr(DOCS), GREEN, { status: 'pending', detail: 'x' }, 0);
    expect(d.decision).toBe('wait');
  });

  it('a disputed finding escalates, even while checks run', () => {
    const d = decide(auto, pr(DOCS), [], { ...CLEAN, disputed: 1 }, 0);
    expect(d.decision).toBe('escalate');
    expect(rules(d)).toContain('disputed');
  });

  it('an open blocking finding escalates', () => {
    const d = decide(auto, pr(DOCS), GREEN, { ...CLEAN, openBlocking: 2 }, 0);
    expect(rules(d)).toEqual(['open-findings']);
    expect(d.decision).toBe('escalate');
  });

  it.each(['fix', 'escalate'] as const)('a %s recommendation escalates', (recommendation) => {
    const d = decide(auto, pr(DOCS), GREEN, { ...CLEAN, recommendation }, 0);
    expect(rules(d)).toEqual(['recommendation']);
  });

  it('a revert rate at or over the ceiling escalates; none merged yet passes', () => {
    expect(rules(decide(auto, pr(DOCS), GREEN, CLEAN, 0.02))).toEqual(['revert-rate']);
    expect(decide(auto, pr(DOCS), GREEN, CLEAN, 0.019).decision).toBe('merge');
    expect(decide(auto, pr(DOCS), GREEN, CLEAN, null).decision).toBe('merge');
  });

  it('a non-factory branch escalates', () => {
    const d = decide(auto, pr(DOCS, { headRef: 'slice/W19' }), GREEN, CLEAN, 0);
    expect(rules(d)).toEqual(['factory-branch']);
  });

  it('a needs-human label escalates', () => {
    const d = decide(auto, pr(DOCS, { labels: ['needs-human'] }), GREEN, CLEAN, 0);
    expect(rules(d)).toEqual(['needs-human']);
  });

  it.each<MergeMode>(['auto', 'shadow', 'escalate'])(
    'a disputed finding or red check never merges with every group %s',
    (mode) => {
      const policy = policyWith({}, mode);
      const red = GREEN.map((c) => (c.name === 'Checks' ? { ...c, state: 'fail' as const } : c));
      expect(decide(policy, pr(DOCS), red, CLEAN, 0).decision).toBe('escalate');
      expect(decide(policy, pr(DOCS), GREEN, { ...CLEAN, disputed: 1 }, 0).decision).toBe(
        'escalate',
      );
    },
  );
});

describe('decide: thresholds', () => {
  const big = pr(DOCS, { files: [{ path: 'docs/UX.md', additions: 300, deletions: 0 }] });

  it('applies global thresholds', () => {
    const policy = {
      ...policyWith({ docs: 'auto' }),
      thresholds: { maxChangedLines: 200, minConfidence: 0.8, maxRisk: 'low' as const },
    };
    expect(rules(decide(policy, big, GREEN, CLEAN, 0))).toEqual(['max-lines']);
    expect(rules(decide(policy, pr(DOCS), GREEN, { ...CLEAN, confidence: 0.5 }, 0))).toEqual([
      'min-confidence',
    ]);
    expect(rules(decide(policy, pr(DOCS), GREEN, { ...CLEAN, risk: 'medium' }, 0))).toEqual([
      'max-risk',
    ]);
  });

  it('a group threshold overrides the global one, either way', () => {
    const base = policyWith({ docs: 'auto' });
    const looser = {
      ...base,
      thresholds: { maxChangedLines: 100 },
      groups: base.groups.map((g) =>
        g.id === 'docs' ? { ...g, thresholds: { maxChangedLines: 500 } } : g,
      ),
    };
    expect(decide(looser, big, GREEN, CLEAN, 0).decision).toBe('merge');
    const stricter = {
      ...base,
      thresholds: { maxChangedLines: 500 },
      groups: base.groups.map((g) =>
        g.id === 'docs' ? { ...g, thresholds: { maxChangedLines: 100 } } : g,
      ),
    };
    expect(rules(decide(stricter, big, GREEN, CLEAN, 0))).toEqual(['max-lines']);
    const unlimited = {
      ...base,
      thresholds: { maxChangedLines: 100 },
      groups: base.groups.map((g) =>
        g.id === 'docs' ? { ...g, thresholds: { maxChangedLines: null } } : g,
      ),
    };
    expect(decide(unlimited, big, GREEN, CLEAN, 0).decision).toBe('merge');
  });

  it("doesn't count the lockfile or fixtures as changed lines", () => {
    const d = decide(
      REAL_POLICY,
      pr([], {
        files: [
          { path: 'pnpm-lock.yaml', additions: 900, deletions: 900 },
          { path: 'data/fixtures/azul/a.json', additions: 50, deletions: 0 },
          { path: 'package.json', additions: 1, deletions: 1 },
        ],
      }),
      GREEN,
      CLEAN,
      0,
    );
    expect(d.changedLines).toBe(2);
  });
});

describe('planActions', () => {
  const merge = decide(policyWith({ docs: 'auto' }), pr(DOCS), GREEN, CLEAN, 0);

  it('merges in auto mode, rebasing first when behind main', () => {
    expect(planActions(merge, { behind: false })).toEqual([
      { kind: 'comment', mention: false },
      { kind: 'merge' },
    ]);
    expect(planActions(merge, { behind: true })).toEqual([{ kind: 'rebase' }]);
  });

  it('only records in shadow mode', () => {
    const shadow = decide(REAL_POLICY, pr(DOCS), GREEN, CLEAN, 0);
    expect(planActions(shadow, { behind: false })).toEqual([
      { kind: 'comment', mention: false },
      { kind: 'label', add: 'shadow:merge', remove: ['shadow:escalate'] },
    ]);
  });

  it('escalates live with a mention and needs-human', () => {
    const d = decide(policyWith({}, 'auto'), pr(['AGENTS.md']), GREEN, CLEAN, 0);
    expect(planActions(d, { behind: false })).toEqual([
      { kind: 'comment', mention: true },
      { kind: 'label', add: 'needs-human', remove: [] },
    ]);
  });

  it('does nothing while waiting', () => {
    expect(planActions(decide(REAL_POLICY, pr(DOCS), [], CLEAN, 0), { behind: false })).toEqual([]);
  });
});

describe('decision record', () => {
  const entry = {
    sha: 'a1',
    decision: 'merge' as const,
    mode: 'shadow' as const,
    groups: ['docs'],
    at: '2026-11-20T00:00:00Z',
  };

  it('round-trips through the comment and skips repeats', () => {
    const decision = decide(REAL_POLICY, pr(DOCS), GREEN, CLEAN, 0);
    const history = appendDecision(appendDecision([], entry), { ...entry, at: 'later' });
    expect(history).toHaveLength(1);
    const body = formatDecisionComment({ decision, history, mention: 'owner' });
    expect(parseDecisionHistory(body)).toEqual([entry]);
    expect(body).not.toContain('@owner');
    expect(appendDecision(history, { ...entry, sha: 'b2' })).toHaveLength(2);
  });

  it('mentions the owner only on a live escalation', () => {
    const d = decide(policyWith({}, 'auto'), pr(['AGENTS.md']), GREEN, CLEAN, 0);
    expect(formatDecisionComment({ decision: d, history: [], mention: 'owner' })).toContain(
      '@owner',
    );
  });

  it('reads no history from a body without one', () => {
    expect(parseDecisionHistory('hello')).toEqual([]);
    expect(parseDecisionHistory('<!-- merge-record {"history": 3} -->')).toEqual([]);
  });
});

describe('reading GitHub state', () => {
  const reviewBody = buildReviewPayload(
    {
      findings: [
        { file: 'a.ts', line: 1, severity: 'should-fix', summary: 's', failureScenario: 'f' },
        { file: 'b.ts', line: 2, severity: 'nit', summary: 's', failureScenario: 'f' },
      ],
      verdict: { risk: 'medium', confidence: 0.72, recommendation: 'fix', reasons: ['r'] },
    },
    new Map([['a.ts', new Set([1])]]),
  );

  it('parses the verdict line that review/post.ts writes', () => {
    expect(parseVerdict(reviewBody.body)).toEqual({
      recommendation: 'fix',
      risk: 'medium',
      confidence: 0.72,
    });
    expect(parseVerdict('no verdict')).toBeNull();
  });

  it('counts blocking findings in the head review, inline and off-diff', () => {
    const reviews: ReviewNode[] = [
      {
        body: reviewBody.body,
        commitSha: 'head',
        comments: reviewBody.comments.map((c) => c.body),
      },
    ];
    const outcome = reviewOutcome({
      reviews,
      threads: [],
      headSha: 'head',
      reviewRunning: false,
      blockingSeverity: 'should-fix',
    });
    expect(outcome).toMatchObject({ status: 'done', openBlocking: 1, recommendation: 'fix' });
    const nits = reviewOutcome({
      reviews,
      threads: [],
      headSha: 'head',
      reviewRunning: false,
      blockingSeverity: 'nit',
    });
    expect(nits).toMatchObject({ openBlocking: 2 });
  });

  it('is pending without a review on the head commit, or while a review runs', () => {
    const reviews: ReviewNode[] = [{ body: reviewBody.body, commitSha: 'old', comments: [] }];
    expect(
      reviewOutcome({
        reviews,
        threads: [],
        headSha: 'head',
        reviewRunning: false,
        blockingSeverity: 'should-fix',
      }).status,
    ).toBe('pending');
    const onHead: ReviewNode[] = [{ ...reviews[0]!, commitSha: 'head' }];
    expect(
      reviewOutcome({
        reviews: onHead,
        threads: [],
        headSha: 'head',
        reviewRunning: true,
        blockingSeverity: 'should-fix',
      }).status,
    ).toBe('pending');
  });

  it('counts unresolved threads with a disputed reply', () => {
    expect(
      countDisputed([
        { isResolved: false, comments: ['**[should-fix]** x', 'disputed: the spec says so'] },
        { isResolved: true, comments: ['x', 'Disputed: no'] },
        { isResolved: false, comments: ['x', 'fixed in abc123'] },
      ]),
    ).toBe(1);
  });

  it('maps the status rollup to check results, latest run last', () => {
    expect(
      rollupToChecks([
        {
          __typename: 'CheckRun',
          name: 'E2E',
          status: 'COMPLETED',
          conclusion: 'SUCCESS',
          startedAt: '2026-11-20T02:00:00Z',
        },
        {
          __typename: 'CheckRun',
          name: 'E2E',
          status: 'COMPLETED',
          conclusion: 'FAILURE',
          startedAt: '2026-11-20T01:00:00Z',
        },
        {
          __typename: 'CheckRun',
          name: 'CV',
          status: 'COMPLETED',
          conclusion: 'SKIPPED',
          startedAt: '2026-11-20T01:00:00Z',
        },
        {
          __typename: 'CheckRun',
          name: 'API',
          status: 'IN_PROGRESS',
          conclusion: null,
          startedAt: '2026-11-20T01:00:00Z',
        },
        {
          __typename: 'StatusContext',
          context: 'Vercel',
          state: 'FAILURE',
          startedAt: '2026-11-20T01:00:00Z',
        },
      ]),
    ).toEqual([
      { name: 'E2E', state: 'fail' },
      { name: 'CV', state: 'pass' },
      { name: 'API', state: 'pending' },
      { name: 'Vercel', state: 'fail' },
      { name: 'E2E', state: 'pass' },
    ]);
  });

  it('computes the revert rate over the most recent merged PRs', () => {
    const merged = (number: number, day: number, sha: string) => ({
      number,
      title: `PR ${String(number)}`,
      headRefName: 'factory/x',
      mergedAt: `2026-11-${String(day).padStart(2, '0')}T00:00:00Z`,
      mergeCommitSha: sha,
      labels: [],
      reviewRounds: null,
      firstPushPassed: null,
    });
    const prs = [merged(1, 1, 'aaaaaaa1'), merged(2, 2, 'bbbbbbb2'), merged(3, 3, 'ccccccc3')];
    const commits = [{ sha: 'r', subject: 'Revert', body: 'This reverts commit aaaaaaa1.' }];
    expect(revertRate(commits, prs, 3)).toBeCloseTo(1 / 3);
    expect(revertRate(commits, prs, 2)).toBe(0);
    expect(revertRate(commits, [], 2)).toBeNull();
  });
});
