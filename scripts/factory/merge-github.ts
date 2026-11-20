// Reads a PR's state from GitHub for W19's merge decision. Parsers are pure and tested in
// `merge-policy.test.ts`; the `read*` functions call `gh`.
import { execFileSync } from 'node:child_process';

import { z } from 'zod';

import { extractRevertedPrs } from '../lib/metrics/reverts';
import type { GitCommit, MergedPr } from '../lib/metrics/types';
import {
  FindingSeveritySchema,
  REVIEW_MARKER,
  type FindingSeverity,
  type ReviewVerdict,
} from '../review/findings';

import type { CheckResult, PrFacts, ReviewOutcome } from './merge-policy';

const VERDICT_RE =
  /### Verdict: `(merge|fix|escalate)` \(risk: `(low|medium|high)`, confidence: ([0-9]*\.?[0-9]+)\)/;
const SEVERITY_RANK: Record<FindingSeverity, number> = { blocking: 3, 'should-fix': 2, nit: 1 };
const SEVERITY_TAG_RE = /\*\*\[(blocking|should-fix|nit)\]\*\*/g;

/** The verdict line `scripts/review/post.ts` writes at the top of every factory review. */
export function parseVerdict(
  body: string,
): Pick<ReviewVerdict, 'recommendation' | 'risk' | 'confidence'> | null {
  const match = VERDICT_RE.exec(body);
  if (!match) return null;
  const [, recommendation, risk, confidence] = match;
  const parsed = z
    .object({
      recommendation: z.enum(['merge', 'fix', 'escalate']),
      risk: z.enum(['low', 'medium', 'high']),
      confidence: z.coerce.number().min(0).max(1),
    })
    .safeParse({ recommendation, risk, confidence });
  return parsed.success ? parsed.data : null;
}

/** Severities of the findings in a review's body (off-diff findings) and inline comments. */
export function findingSeverities(texts: readonly string[]): FindingSeverity[] {
  return texts.flatMap((text) =>
    [...text.matchAll(SEVERITY_TAG_RE)].map((m) => FindingSeveritySchema.parse(m[1])),
  );
}

export type ReviewNode = { body: string; commitSha: string | null; comments: string[] };
export type ThreadNode = { isResolved: boolean; comments: string[] };

/** Unresolved review threads where someone replied `disputed: <reason>` (W11's fix round). */
export function countDisputed(threads: readonly ThreadNode[]): number {
  return threads.filter(
    (thread) => !thread.isResolved && thread.comments.some((c) => /^\s*disputed:/im.test(c)),
  ).length;
}

export function reviewOutcome(opts: {
  reviews: readonly ReviewNode[];
  threads: readonly ThreadNode[];
  headSha: string;
  reviewRunning: boolean;
  blockingSeverity: FindingSeverity;
}): ReviewOutcome {
  if (opts.reviewRunning) {
    return { status: 'pending', detail: 'The review workflow is still running for this branch.' };
  }
  const latest = opts.reviews
    .filter((r) => r.body.includes(REVIEW_MARKER) && r.commitSha === opts.headSha)
    .at(-1);
  if (!latest) {
    return { status: 'pending', detail: 'No factory review on the head commit yet.' };
  }
  const verdict = parseVerdict(latest.body);
  if (!verdict) {
    return { status: 'pending', detail: 'The head commit review has no readable verdict line.' };
  }
  const severities = findingSeverities([latest.body, ...latest.comments]);
  const openBlocking = severities.filter(
    (severity) => SEVERITY_RANK[severity] >= SEVERITY_RANK[opts.blockingSeverity],
  ).length;
  return { status: 'done', ...verdict, openBlocking, disputed: countDisputed(opts.threads) };
}

const RollupItemSchema = z.union([
  z.object({
    __typename: z.literal('CheckRun'),
    name: z.string(),
    status: z.string(),
    conclusion: z.string().nullable().optional(),
    startedAt: z.string().nullable().optional(),
  }),
  z.object({
    __typename: z.literal('StatusContext'),
    context: z.string(),
    state: z.string(),
    startedAt: z.string().nullable().optional(),
  }),
]);
export type RollupItem = z.infer<typeof RollupItemSchema>;

const PASSING = new Set(['SUCCESS', 'NEUTRAL', 'SKIPPED']);

/** `gh pr view --json statusCheckRollup` items as check results, oldest run first. */
export function rollupToChecks(items: readonly RollupItem[]): CheckResult[] {
  return [...items]
    .sort((a, b) => (a.startedAt ?? '').localeCompare(b.startedAt ?? ''))
    .map((item): CheckResult => {
      if (item.__typename === 'CheckRun') {
        if (item.status !== 'COMPLETED') return { name: item.name, state: 'pending' };
        return { name: item.name, state: PASSING.has(item.conclusion ?? '') ? 'pass' : 'fail' };
      }
      if (item.state === 'PENDING' || item.state === 'EXPECTED') {
        return { name: item.context, state: 'pending' };
      }
      return { name: item.context, state: item.state === 'SUCCESS' ? 'pass' : 'fail' };
    });
}

/** Share of the most recent `window` merged PRs that were later reverted (null with none). */
export function revertRate(
  commits: readonly GitCommit[],
  prs: readonly MergedPr[],
  window: number,
): number | null {
  const recent = [...prs].sort((a, b) => b.mergedAt.localeCompare(a.mergedAt)).slice(0, window);
  if (recent.length === 0) return null;
  const reverted = extractRevertedPrs(commits, prs);
  return recent.filter((pr) => reverted.has(pr.number)).length / recent.length;
}

// --- gh calls ---

function gh(args: readonly string[], cwd: string): string {
  return execFileSync('gh', args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

const PrViewSchema = z.object({
  number: z.number(),
  state: z.string(),
  body: z.string(),
  headRefName: z.string(),
  headRefOid: z.string(),
  mergeStateStatus: z.string(),
  labels: z.array(z.object({ name: z.string() })),
  files: z.array(z.object({ path: z.string(), additions: z.number(), deletions: z.number() })),
  statusCheckRollup: z.array(RollupItemSchema).nullable(),
});

export type PrState = {
  facts: PrFacts;
  open: boolean;
  body: string;
  /** GitHub's `mergeStateStatus` is `BEHIND`: the base moved on since the branch was cut. */
  behind: boolean;
  checks: CheckResult[];
};

export function readPrState(prNumber: number, cwd: string): PrState {
  const raw = gh(
    [
      'pr',
      'view',
      String(prNumber),
      '--json',
      'number,state,body,headRefName,headRefOid,mergeStateStatus,labels,files,statusCheckRollup',
    ],
    cwd,
  );
  const pr = PrViewSchema.parse(JSON.parse(raw));
  return {
    facts: {
      number: pr.number,
      headRef: pr.headRefName,
      headSha: pr.headRefOid,
      labels: pr.labels.map((l) => l.name),
      files: pr.files,
    },
    open: pr.state === 'OPEN',
    body: pr.body,
    behind: pr.mergeStateStatus === 'BEHIND',
    checks: rollupToChecks(pr.statusCheckRollup ?? []),
  };
}

const REVIEW_QUERY = `query($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) {
      reviews(last: 30) { nodes { body commit { oid } comments(first: 100) { nodes { body } } } }
      reviewThreads(first: 100) { nodes { isResolved comments(first: 50) { nodes { body } } } }
    }
  }
}`;

const Bodies = z.object({ nodes: z.array(z.object({ body: z.string() })) });
const ReviewQuerySchema = z.object({
  data: z.object({
    repository: z.object({
      pullRequest: z.object({
        reviews: z.object({
          nodes: z.array(
            z.object({
              body: z.string(),
              commit: z.object({ oid: z.string() }).nullable(),
              comments: Bodies,
            }),
          ),
        }),
        reviewThreads: z.object({
          nodes: z.array(z.object({ isResolved: z.boolean(), comments: Bodies })),
        }),
      }),
    }),
  }),
});

const RunListSchema = z.array(z.object({ status: z.string() }));

export function readReviewOutcome(opts: {
  repo: string;
  prNumber: number;
  headRef: string;
  headSha: string;
  blockingSeverity: FindingSeverity;
  cwd: string;
}): ReviewOutcome {
  const [owner = '', name = ''] = opts.repo.split('/');
  const raw = gh(
    [
      'api',
      'graphql',
      '-f',
      `query=${REVIEW_QUERY}`,
      '-F',
      `owner=${owner}`,
      '-F',
      `name=${name}`,
      '-F',
      `number=${String(opts.prNumber)}`,
    ],
    opts.cwd,
  );
  const pr = ReviewQuerySchema.parse(JSON.parse(raw)).data.repository.pullRequest;
  const runs = RunListSchema.parse(
    JSON.parse(
      gh(
        [
          'run',
          'list',
          '--workflow',
          'review.yml',
          '--branch',
          opts.headRef,
          '--limit',
          '5',
          '--json',
          'status',
        ],
        opts.cwd,
      ),
    ),
  );
  return reviewOutcome({
    reviews: pr.reviews.nodes.map((r) => ({
      body: r.body,
      commitSha: r.commit?.oid ?? null,
      comments: r.comments.nodes.map((c) => c.body),
    })),
    threads: pr.reviewThreads.nodes.map((t) => ({
      isResolved: t.isResolved,
      comments: t.comments.nodes.map((c) => c.body),
    })),
    headSha: opts.headSha,
    reviewRunning: runs.some((run) => run.status !== 'completed'),
    blockingSeverity: opts.blockingSeverity,
  });
}

const MergedPrSchema = z.object({
  number: z.number(),
  title: z.string(),
  headRefName: z.string(),
  mergedAt: z.string(),
  mergeCommit: z.object({ oid: z.string() }).nullable(),
});

export function readRevertRate(window: number, cwd: string): number | null {
  const prs = z
    .array(MergedPrSchema)
    .parse(
      JSON.parse(
        gh(
          [
            'pr',
            'list',
            '--state',
            'merged',
            '--limit',
            String(Math.max(window, 200)),
            '--json',
            'number,title,headRefName,mergedAt,mergeCommit',
          ],
          cwd,
        ),
      ),
    )
    .map((pr): MergedPr => ({
      number: pr.number,
      title: pr.title,
      headRefName: pr.headRefName,
      mergedAt: pr.mergedAt,
      mergeCommitSha: pr.mergeCommit?.oid ?? null,
      labels: [],
      reviewRounds: null,
      firstPushPassed: null,
    }));
  const sep = '\u001e';
  const fieldSep = '\u001f';
  const log = execFileSync(
    'git',
    ['log', 'origin/main', '--max-count=500', `--format=%H${fieldSep}%s${fieldSep}%b${sep}`],
    { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );
  const commits = log
    .split(sep)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry): GitCommit => {
      const [sha = '', subject = '', body = ''] = entry.split(fieldSep);
      return { sha, subject, body };
    });
  return revertRate(commits, prs, window);
}
