// W19 merge authority: decides a factory PR's fate with `merge-policy.ts` and acts on it.
// Run by `.github/workflows/merge.yml`; locally `pnpm merge:decide --pr <n>` prints the
// decision without acting (`--act` to act, which needs the factory's token).
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { z } from 'zod';

import { extractSessionIdFromPrBody } from '../review/post';

import { loadFactoryConfig, type FactoryConfig } from './config';
import { readPrState, readReviewOutcome, readRevertRate } from './merge-github';
import {
  appendDecision,
  DECISION_MARKER,
  decide,
  formatDecisionComment,
  loadMergePolicy,
  NEEDS_HUMAN_LABEL,
  parseDecisionHistory,
  type MergeDecision,
} from './merge-policy';
import { claudeProjectDir, decryptSessionDir, encryptSessionDir } from './session';
import { markCheckoutTrusted } from './trust';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');

export const SHADOW_LABELS = { merge: 'shadow:merge', escalate: 'shadow:escalate' } as const;

export type MergeAction =
  | { kind: 'comment'; mention: boolean }
  | { kind: 'label'; add: string; remove: string[] }
  | { kind: 'merge' }
  | { kind: 'rebase' };

/**
 * What to do with a decision. `wait` does nothing (a later CI or Review completion runs this
 * again). Shadow mode records; live mode merges (rebasing first when behind `main`) or escalates.
 */
export function planActions(decision: MergeDecision, opts: { behind: boolean }): MergeAction[] {
  if (decision.decision === 'wait') return [];
  if (decision.mode === 'shadow') {
    const other = decision.decision === 'merge' ? SHADOW_LABELS.escalate : SHADOW_LABELS.merge;
    return [
      { kind: 'comment', mention: false },
      { kind: 'label', add: SHADOW_LABELS[decision.decision], remove: [other] },
    ];
  }
  if (decision.decision === 'escalate') {
    return [
      { kind: 'comment', mention: true },
      { kind: 'label', add: NEEDS_HUMAN_LABEL, remove: [] },
    ];
  }
  if (opts.behind) return [{ kind: 'rebase' }];
  return [{ kind: 'comment', mention: false }, { kind: 'merge' }];
}

function gh(args: readonly string[], input?: string): string {
  return execFileSync('gh', args, {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    ...(input === undefined ? {} : { input }),
  });
}

const CommentSchema = z.array(
  z.object({ id: z.number(), body: z.string(), user: z.object({ login: z.string() }).nullable() }),
);

function upsertDecisionComment(opts: {
  repo: string;
  prNumber: number;
  headSha: string;
  decision: MergeDecision;
  mention: string | undefined;
}): void {
  // `--slurp` wraps each page in an outer array.
  const comments = z
    .array(CommentSchema)
    .parse(
      JSON.parse(
        gh([
          'api',
          '--paginate',
          '--slurp',
          `repos/${opts.repo}/issues/${String(opts.prNumber)}/comments`,
        ]),
      ),
    )
    .flat();
  const existing = comments.filter((c) => c.body.includes(DECISION_MARKER)).at(-1);
  const final = opts.decision.decision === 'wait' ? null : opts.decision.decision;
  const history = parseDecisionHistory(existing?.body ?? '');
  const nextHistory = final
    ? appendDecision(history, {
        sha: opts.headSha,
        decision: final,
        mode: opts.decision.mode,
        groups: opts.decision.groups,
        at: new Date().toISOString(),
      })
    : history;
  const body = formatDecisionComment({
    decision: opts.decision,
    history: nextHistory,
    mention: opts.mention,
  });
  if (existing) {
    gh([
      'api',
      '-X',
      'PATCH',
      `repos/${opts.repo}/issues/comments/${String(existing.id)}`,
      '-f',
      `body=${body}`,
    ]);
  } else {
    gh(['pr', 'comment', String(opts.prNumber), '--body', body]);
  }
}

function applyLabel(
  prNumber: number,
  add: string,
  remove: readonly string[],
  labels: readonly string[],
): void {
  if (add.startsWith('shadow:')) {
    gh([
      'label',
      'create',
      add,
      '--color',
      'c5def5',
      '--description',
      'W19 shadow decision',
      '--force',
    ]);
  }
  const args = ['pr', 'edit', String(prNumber), '--add-label', add];
  for (const label of remove) {
    if (labels.includes(label)) args.push('--remove-label', label);
  }
  gh(args);
}

/** Asks the builder's session to rebase on `main` (W11's resume path); its push reruns checks. */
function requestRebase(
  prNumber: number,
  headRef: string,
  prBody: string,
  config: FactoryConfig,
): void {
  const sessionId = extractSessionIdFromPrBody(prBody);
  const key = process.env.FACTORY_SESSION_KEY ?? '';
  if (!sessionId || !key) {
    console.log(`PR #${String(prNumber)}: behind main but no session id or key; escalating.`);
    gh(['pr', 'edit', String(prNumber), '--add-label', NEEDS_HUMAN_LABEL]);
    gh([
      'pr',
      'comment',
      String(prNumber),
      '--body',
      'Merge authority: this PR is behind `main` and its builder session could not be resumed to rebase it.',
    ]);
    return;
  }
  const encFile = join(ROOT, '.scratch', `session-${sessionId}.tar.gz.enc`);
  if (!existsSync(encFile)) {
    mkdirSync(dirname(encFile), { recursive: true });
    gh(['run', 'download', '-n', `session-${sessionId}`, '-D', dirname(encFile)]);
  }
  const sessionDir = claudeProjectDir(ROOT);
  decryptSessionDir(encFile, sessionDir, key);
  markCheckoutTrusted(ROOT);
  execFileSync('npm', ['install', '-g', '@anthropic-ai/claude-code'], {
    cwd: ROOT,
    stdio: 'inherit',
  });
  const prompt = [
    `PR #${String(prNumber)} passed merge authority but is behind main.`,
    `This checkout is on main: run \`git fetch origin && git switch ${headRef}\` first.`,
    'Rebase it on origin/main, resolving shared-doc conflicts as AGENTS.md → Parallel sessions says (keep both sides, renumber your decision ids after the new ones).',
    'Run `pnpm typecheck` and `pnpm check:repo`, then push with `git push --force-with-lease`. Do nothing else.',
  ].join('\n');
  spawnSync(
    'claude',
    [
      '--resume',
      sessionId,
      '-p',
      prompt,
      '--model',
      config.builder.model,
      '--effort',
      config.builder.effort,
      '--max-turns',
      String(config.builder.maxTurns),
      '--dangerously-skip-permissions',
    ],
    {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      timeout: config.builder.timeoutMinutes * 60_000,
    },
  );
  encryptSessionDir(sessionDir, encFile, key);
}

const OpenPrSchema = z.array(z.object({ number: z.number() }));

function resolvePrNumber(argv: readonly string[]): number | null {
  const flag = argv.indexOf('--pr');
  const fromArg = flag === -1 ? undefined : argv[flag + 1];
  const raw = fromArg ?? process.env.PR_NUMBER ?? '';
  const parsed = Number.parseInt(raw, 10);
  if (Number.isFinite(parsed)) return parsed;
  const branch = process.env.HEAD_BRANCH ?? '';
  if (!branch) return null;
  const open = OpenPrSchema.parse(
    JSON.parse(gh(['pr', 'list', '--state', 'open', '--head', branch, '--json', 'number'])),
  );
  return open[0]?.number ?? null;
}

function main(): void {
  const argv = process.argv.slice(2);
  const act = argv.includes('--act') && process.env.MERGE_DRY_RUN !== 'true';
  const prNumber = resolvePrNumber(argv);
  if (prNumber === null) {
    console.log(
      'No open PR for this run (pass --pr <n>, PR_NUMBER or HEAD_BRANCH); nothing to do.',
    );
    return;
  }
  const repo =
    process.env.GITHUB_REPOSITORY ??
    gh(['repo', 'view', '--json', 'nameWithOwner', '--jq', '.nameWithOwner']).trim();
  const policy = loadMergePolicy(join(ROOT, '.github/factory/merge-policy.json'));
  const config = loadFactoryConfig(join(ROOT, '.github/factory/config.json'));

  const state = readPrState(prNumber, repo, ROOT);
  if (!state.open) {
    console.log(`PR #${String(prNumber)} is not open; nothing to do.`);
    return;
  }
  if (!state.facts.headRef.startsWith('factory/')) {
    console.log(
      `PR #${String(prNumber)} is from ${state.facts.headRef}, not factory/*: the owner's to merge.`,
    );
    return;
  }
  const review = readReviewOutcome({
    repo,
    prNumber,
    headRef: state.facts.headRef,
    headSha: state.facts.headSha,
    blockingSeverity: config.review?.blockingSeverity ?? 'should-fix',
    cwd: ROOT,
  });
  const revertRate = readRevertRate(policy.revertWindow, ROOT);
  const decision = decide(policy, state.facts, state.checks, review, revertRate);
  const actions = planActions(decision, { behind: state.behind });

  console.log(
    JSON.stringify({ pr: prNumber, sha: state.facts.headSha, ...decision, actions }, null, 2),
  );
  if (!act) {
    console.log('Dry run: no comment, label or merge (pass --act to act).');
    return;
  }

  const owner = process.env.GITHUB_REPOSITORY_OWNER ?? repo.split('/')[0];
  for (const action of actions) {
    switch (action.kind) {
      case 'comment':
        upsertDecisionComment({
          repo,
          prNumber,
          headSha: state.facts.headSha,
          decision,
          mention: action.mention ? owner : undefined,
        });
        break;
      case 'label':
        applyLabel(prNumber, action.add, action.remove, state.facts.labels);
        break;
      case 'merge':
        gh([
          'pr',
          'merge',
          String(prNumber),
          '--rebase',
          '--match-head-commit',
          state.facts.headSha,
        ]);
        break;
      case 'rebase':
        requestRebase(prNumber, state.facts.headRef, state.body, config);
        break;
    }
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main();
}
