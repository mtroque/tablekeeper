// W19 merge authority: the policy file's schema and the pure decision over a PR's state.
// `scripts/factory/merge.ts` gathers the inputs and acts on the result.
import { readFileSync } from 'node:fs';

import { z } from 'zod';

import { expandBraces, patternToRegExp } from '../lib/check-repo/ownership';
import type { ReviewVerdict } from '../review/findings';

export const MergeModeSchema = z.enum(['auto', 'shadow', 'escalate']);
export type MergeMode = z.infer<typeof MergeModeSchema>;

const RiskSchema = z.enum(['low', 'medium', 'high']);
type Risk = z.infer<typeof RiskSchema>;

/** `null` means no limit; a group leaves a key out to use the global value. */
const ThresholdsSchema = z.object({
  maxChangedLines: z.int().min(1).nullable().optional(),
  minConfidence: z.number().min(0).max(1).nullable().optional(),
  maxRisk: RiskSchema.nullable().optional(),
});
type Thresholds = z.infer<typeof ThresholdsSchema>;

const PathGroupSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]*$/),
  mode: MergeModeSchema,
  paths: z.array(z.string().min(1)).min(1),
  exclude: z.array(z.string().min(1)).default([]),
  thresholds: ThresholdsSchema.optional(),
});
export type PathGroup = z.infer<typeof PathGroupSchema>;

export const MergePolicySchema = z
  .object({
    revertRateCeiling: z.number().min(0).max(1),
    revertWindow: z.int().min(1),
    thresholds: ThresholdsSchema,
    groups: z.array(PathGroupSchema).min(1),
  })
  .refine((policy) => new Set(policy.groups.map((g) => g.id)).size === policy.groups.length, {
    message: 'Group ids must be unique.',
  });
export type MergePolicy = z.infer<typeof MergePolicySchema>;

export function parseMergePolicy(rawJson: string): MergePolicy {
  return MergePolicySchema.parse(JSON.parse(rawJson));
}

export function loadMergePolicy(path: string): MergePolicy {
  return parseMergePolicy(readFileSync(path, 'utf8'));
}

/**
 * Fixed rules: no policy value changes these. A PR touching any of these paths always escalates,
 * so the reviewer never widens its own authority and the instructions every agent follows get a
 * human look.
 */
export const ALWAYS_ESCALATE_PATHS = [
  '.github/factory/**',
  '.github/workflows/**',
  '.github/workflow-drafts/**',
  '.agents/skills/**',
  '.claude/settings.json',
  '.claude/skills/**',
  'AGENTS.md',
  'scripts/factory/**',
] as const;

/** Checks that must be green: W1's `Checks`, W7's `API` and `E2E`, W9's `CV`. */
export const REQUIRED_CHECKS = ['Checks', 'API', 'E2E', 'CV'] as const;

/** Changed lines in these paths don't count toward `maxChangedLines`. */
const UNCOUNTED_PATHS = ['pnpm-lock.yaml', 'data/fixtures/**'];

export const NEEDS_HUMAN_LABEL = 'needs-human';

export type PrFile = { path: string; additions: number; deletions: number };

export type PrFacts = {
  number: number;
  headRef: string;
  headSha: string;
  labels: readonly string[];
  files: readonly PrFile[];
};

export type CheckState = 'pass' | 'fail' | 'pending';
/** One entry per check name; when a check ran more than once, the latest run comes last. */
export type CheckResult = { name: string; state: CheckState };

/** What W11's review loop left on the head commit. */
export type ReviewOutcome =
  | { status: 'pending'; detail: string }
  | ({
      status: 'done';
      /** Findings at or above `blockingSeverity` on the head commit's review. */
      openBlocking: number;
      /** Unresolved threads with a `disputed:` reply. */
      disputed: number;
    } & Pick<ReviewVerdict, 'recommendation' | 'risk' | 'confidence'>);

export type RuleId =
  | 'factory-branch'
  | 'needs-human'
  | 'checks'
  | 'review'
  | 'disputed'
  | 'open-findings'
  | 'recommendation'
  | 'revert-rate'
  | 'always-escalate'
  | 'unlisted-path'
  | 'group-escalate'
  | 'group-shadow'
  | 'max-lines'
  | 'min-confidence'
  | 'max-risk'
  | 'empty';

export type Reason = {
  rule: RuleId;
  outcome: 'wait' | 'escalate';
  /** Hard escalations win over waiting; the others wait until checks and review are done. */
  hard: boolean;
  detail: string;
};

export type DecisionOutcome = 'merge' | 'wait' | 'escalate';

export type MergeDecision = {
  decision: DecisionOutcome;
  /**
   * `shadow`: record only (every touched group is in shadow mode). `auto`: act on the decision.
   * `escalate`: a path, group or unlisted file forces escalation, acted on in every mode.
   */
  mode: MergeMode;
  groups: string[];
  changedLines: number;
  reasons: Reason[];
};

const RISK_RANK: Record<Risk, number> = { low: 1, medium: 2, high: 3 };

function matchesAny(path: string, patterns: readonly string[]): boolean {
  return patterns.some((pattern) =>
    expandBraces(pattern).some((expanded) => patternToRegExp(expanded).test(path)),
  );
}

/** Ids of the groups a path belongs to (a path can be in several, e.g. auth and shared code). */
export function groupsForPath(policy: MergePolicy, path: string): string[] {
  return policy.groups
    .filter((group) => matchesAny(path, group.paths) && !matchesAny(path, group.exclude))
    .map((group) => group.id);
}

export function isAlwaysEscalatePath(path: string): boolean {
  return matchesAny(path, ALWAYS_ESCALATE_PATHS);
}

export function countChangedLines(files: readonly PrFile[]): number {
  return files
    .filter((file) => !matchesAny(file.path, UNCOUNTED_PATHS))
    .reduce((sum, file) => sum + file.additions + file.deletions, 0);
}

function threshold<K extends keyof Thresholds>(
  policy: MergePolicy,
  group: PathGroup | undefined,
  key: K,
): Thresholds[K] {
  const own = group?.thresholds?.[key];
  return own === undefined ? policy.thresholds[key] : own;
}

function listPaths(paths: readonly string[]): string {
  const shown = paths.slice(0, 5).map((p) => `\`${p}\``);
  return paths.length > 5
    ? `${shown.join(', ')} and ${String(paths.length - 5)} more`
    : shown.join(', ');
}

function checkReasons(checks: readonly CheckResult[]): Reason[] {
  const reasons: Reason[] = [];
  for (const name of REQUIRED_CHECKS) {
    const latest = checks.filter((check) => check.name === name).at(-1);
    if (!latest || latest.state === 'pending') {
      reasons.push({
        rule: 'checks',
        outcome: 'wait',
        hard: false,
        detail: `Required check \`${name}\` ${latest ? 'is still running' : 'has not reported yet'}.`,
      });
    } else if (latest.state === 'fail') {
      reasons.push({
        rule: 'checks',
        outcome: 'escalate',
        hard: true,
        detail: `Required check \`${name}\` failed.`,
      });
    }
  }
  return reasons;
}

function reviewReasons(review: ReviewOutcome): Reason[] {
  if (review.status === 'pending') {
    return [{ rule: 'review', outcome: 'wait', hard: false, detail: review.detail }];
  }
  const reasons: Reason[] = [];
  if (review.disputed > 0) {
    reasons.push({
      rule: 'disputed',
      outcome: 'escalate',
      hard: true,
      detail: `${String(review.disputed)} review finding(s) disputed by the builder and still unresolved.`,
    });
  }
  if (review.openBlocking > 0) {
    reasons.push({
      rule: 'open-findings',
      outcome: 'escalate',
      hard: true,
      detail: `The review loop finished with ${String(review.openBlocking)} blocking finding(s) open on the head commit.`,
    });
  }
  if (review.recommendation !== 'merge') {
    reasons.push({
      rule: 'recommendation',
      outcome: 'escalate',
      hard: false,
      detail: `The reviewer recommended \`${review.recommendation}\`, not \`merge\`.`,
    });
  }
  return reasons;
}

function thresholdReasons(
  policy: MergePolicy,
  touched: readonly PathGroup[],
  changedLines: number,
  review: ReviewOutcome,
): Reason[] {
  const scopes: (PathGroup | undefined)[] = touched.length > 0 ? [...touched] : [undefined];
  const reasons: Reason[] = [];
  for (const group of scopes) {
    const label = group ? `group \`${group.id}\`` : 'the policy';
    const maxLines = threshold(policy, group, 'maxChangedLines');
    if (maxLines != null && changedLines > maxLines) {
      reasons.push({
        rule: 'max-lines',
        outcome: 'escalate',
        hard: false,
        detail: `${String(changedLines)} changed lines, over the ${String(maxLines)} allowed by ${label}.`,
      });
    }
    if (review.status !== 'done') continue;
    const minConfidence = threshold(policy, group, 'minConfidence');
    if (minConfidence != null && review.confidence < minConfidence) {
      reasons.push({
        rule: 'min-confidence',
        outcome: 'escalate',
        hard: false,
        detail: `Reviewer confidence ${review.confidence.toFixed(2)} is under the ${minConfidence.toFixed(2)} required by ${label}.`,
      });
    }
    const maxRisk = threshold(policy, group, 'maxRisk');
    if (maxRisk != null && RISK_RANK[review.risk] > RISK_RANK[maxRisk]) {
      reasons.push({
        rule: 'max-risk',
        outcome: 'escalate',
        hard: false,
        detail: `Reviewer risk \`${review.risk}\` is above the \`${maxRisk}\` allowed by ${label}.`,
      });
    }
  }
  return reasons;
}

/**
 * Decides whether a factory PR merges, waits or escalates, with every reason that applied.
 * Hard escalations (red check, disputed or open finding, `needs-human`, not a factory branch)
 * win; otherwise anything pending makes it wait; then the remaining escalations; else merge.
 */
export function decide(
  policy: MergePolicy,
  pr: PrFacts,
  checks: readonly CheckResult[],
  verdict: ReviewOutcome,
  revertRate: number | null,
): MergeDecision {
  const reasons: Reason[] = [];
  const changedLines = countChangedLines(pr.files);

  if (!pr.headRef.startsWith('factory/')) {
    reasons.push({
      rule: 'factory-branch',
      outcome: 'escalate',
      hard: true,
      detail: `\`${pr.headRef}\` is not a \`factory/*\` branch; owner PRs are the owner's to merge.`,
    });
  }
  if (pr.labels.includes(NEEDS_HUMAN_LABEL)) {
    reasons.push({
      rule: 'needs-human',
      outcome: 'escalate',
      hard: true,
      detail: `The PR is labeled \`${NEEDS_HUMAN_LABEL}\`.`,
    });
  }
  reasons.push(...checkReasons(checks), ...reviewReasons(verdict));
  if (revertRate !== null && revertRate >= policy.revertRateCeiling) {
    reasons.push({
      rule: 'revert-rate',
      outcome: 'escalate',
      hard: false,
      detail: `Revert rate ${(revertRate * 100).toFixed(1)}% is not under the ${(policy.revertRateCeiling * 100).toFixed(1)}% ceiling.`,
    });
  }

  const touchedIds = new Set<string>();
  const unlisted: string[] = [];
  const protectedPaths: string[] = [];
  for (const file of pr.files) {
    if (isAlwaysEscalatePath(file.path)) protectedPaths.push(file.path);
    const ids = groupsForPath(policy, file.path);
    if (ids.length === 0 && !isAlwaysEscalatePath(file.path)) unlisted.push(file.path);
    for (const id of ids) touchedIds.add(id);
  }
  const touched = policy.groups.filter((group) => touchedIds.has(group.id));

  if (pr.files.length === 0) {
    reasons.push({
      rule: 'empty',
      outcome: 'escalate',
      hard: false,
      detail: 'The PR changes no files.',
    });
  }
  if (protectedPaths.length > 0) {
    reasons.push({
      rule: 'always-escalate',
      outcome: 'escalate',
      hard: false,
      detail: `Changes the factory's own policy or agent instructions: ${listPaths(protectedPaths)}.`,
    });
  }
  if (unlisted.length > 0) {
    reasons.push({
      rule: 'unlisted-path',
      outcome: 'escalate',
      hard: false,
      detail: `In no policy group: ${listPaths(unlisted)}.`,
    });
  }
  const escalateGroups = touched.filter((group) => group.mode === 'escalate');
  if (escalateGroups.length > 0) {
    reasons.push({
      rule: 'group-escalate',
      outcome: 'escalate',
      hard: false,
      detail: `Touches group(s) set to \`escalate\`: ${escalateGroups.map((g) => `\`${g.id}\``).join(', ')}.`,
    });
  }

  let mode: MergeMode;
  if (
    pr.files.length === 0 ||
    protectedPaths.length > 0 ||
    unlisted.length > 0 ||
    escalateGroups.length > 0
  ) {
    mode = 'escalate';
  } else if (touched.some((group) => group.mode === 'auto')) {
    mode = 'auto';
    const shadowGroups = touched.filter((group) => group.mode === 'shadow');
    if (shadowGroups.length > 0) {
      reasons.push({
        rule: 'group-shadow',
        outcome: 'escalate',
        hard: false,
        detail: `Also touches group(s) still in \`shadow\`: ${shadowGroups.map((g) => `\`${g.id}\``).join(', ')}.`,
      });
    }
  } else {
    mode = 'shadow';
  }

  reasons.push(...thresholdReasons(policy, touched, changedLines, verdict));

  let decision: DecisionOutcome;
  if (reasons.some((r) => r.outcome === 'escalate' && r.hard)) decision = 'escalate';
  else if (reasons.some((r) => r.outcome === 'wait')) decision = 'wait';
  else if (reasons.some((r) => r.outcome === 'escalate')) decision = 'escalate';
  else decision = 'merge';

  return { decision, mode, groups: [...touchedIds], changedLines, reasons };
}

// Decision records: one hidden JSON history per PR in the decision comment, read back by
// `pnpm metrics` for the shadow agreement column.

export const DECISION_MARKER = '<!-- tablekeeper-merge-decision -->';
const RECORD_RE = /<!-- merge-record (\{.*?\}) -->/s;

export const DecisionEntrySchema = z.object({
  sha: z.string().min(1),
  decision: z.enum(['merge', 'escalate']),
  mode: MergeModeSchema,
  groups: z.array(z.string()),
  at: z.string(),
});
export type DecisionEntry = z.infer<typeof DecisionEntrySchema>;

const DecisionRecordSchema = z.object({ history: z.array(DecisionEntrySchema) });

/** The history in a decision comment body, or `[]` when it has none or it doesn't parse. */
export function parseDecisionHistory(body: string): DecisionEntry[] {
  const json = RECORD_RE.exec(body)?.[1];
  if (!json) return [];
  try {
    return DecisionRecordSchema.parse(JSON.parse(json)).history;
  } catch {
    return [];
  }
}

/** Appends an entry unless the latest one already has the same commit, decision and mode. */
export function appendDecision(
  history: readonly DecisionEntry[],
  entry: DecisionEntry,
): DecisionEntry[] {
  const last = history.at(-1);
  if (
    last &&
    last.sha === entry.sha &&
    last.decision === entry.decision &&
    last.mode === entry.mode
  ) {
    return [...history];
  }
  return [...history, entry];
}

const MODE_TEXT: Record<MergeMode, string> = {
  shadow: 'shadow mode: recorded only, the owner merges as usual',
  auto: 'auto mode',
  escalate: 'escalated by the policy',
};

/** The decision comment: what was decided, why, and the hidden history. */
export function formatDecisionComment(opts: {
  decision: MergeDecision;
  history: readonly DecisionEntry[];
  mention?: string | undefined;
}): string {
  const { decision } = opts;
  const lines = [
    DECISION_MARKER,
    `### Merge authority: \`${decision.decision}\` (${MODE_TEXT[decision.mode]})`,
    '',
    `Groups: ${decision.groups.length > 0 ? decision.groups.map((g) => `\`${g}\``).join(', ') : 'none'}. Changed lines (without lockfile and fixtures): ${String(decision.changedLines)}.`,
    '',
  ];
  if (decision.reasons.length === 0) {
    lines.push('- Every fixed rule passed, and the policy allows merging these groups.');
  } else {
    lines.push(...decision.reasons.map((r) => `- **${r.outcome}** (\`${r.rule}\`): ${r.detail}`));
  }
  if (opts.mention && decision.mode !== 'shadow' && decision.decision === 'escalate') {
    lines.push('', `@${opts.mention} this PR needs your call.`);
  }
  lines.push('', `<!-- merge-record ${JSON.stringify({ history: opts.history })} -->`);
  return lines.join('\n');
}
