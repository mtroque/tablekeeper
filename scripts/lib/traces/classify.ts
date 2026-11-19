import { isWriteTool, pathValues, relativeTo, shellCommand } from './args';
import type {
  BehaviorClass,
  FailureClass,
  Finding,
  GradedSession,
  Session,
  SessionMetrics,
  ToolEvent,
  TraceClass,
} from './types';

export type ClassInfo = {
  /** `docs/CORRECTIONS.md` pattern tag, or null for classes that never become a row. */
  tag: string | null;
  /** Fixed paraphrase used in reports instead of transcript text. */
  wrong: string;
  /** Likely fix: environment, docs, skill or check. */
  fix: string;
};

/** Every class has a fixed tag, reusing the 2026-11-16 `trace` tags where they fit. */
export const CLASSES: Record<TraceClass, ClassInfo> = {
  'worktree-guard': {
    tag: 'worktree-command-refused',
    wrong:
      'The harness refused a command it could not prove stays inside the worktree, and the agent retried variants',
    fix: 'docs: AGENTS.md → Parallel sessions (one plain command per call, edit tools, `.scratch/`)',
  },
  'env-file-denied': {
    tag: 'preflight-reads-denied-file',
    wrong: 'The agent tried to read or list `.env.local`, which `.claude/settings.json` denies',
    fix: 'skill: point at `pnpm preflight`, which checks it without reading it',
  },
  'permission-denied': {
    tag: 'permission-denied',
    wrong: 'A tool call was denied by a permission rule or the classifier',
    fix: 'environment: allow it in the permission profile if it is safe, or skill: avoid the call',
  },
  'user-rejected': {
    tag: null,
    wrong: 'The user rejected a tool call',
    fix: 'judge: check that the correction was logged',
  },
  'commit-msg-hook': {
    tag: 'commit-msg-recovery',
    wrong: 'The commit-msg hook rejected a message and the agent had to rewrite it',
    fix: 'docs: `docs/CONVENTIONS.md` → Git lists the scopes and header length',
  },
  'pre-commit-hook': {
    tag: 'pre-commit-rejected',
    wrong: 'The pre-commit hook (`check:repo --staged`) rejected a commit',
    fix: 'check: run `pnpm verify` before committing; fix what the hook names',
  },
  'missing-file': {
    tag: 'missing-file',
    wrong:
      'A read or command named a file that does not exist, often a stale path in a doc or skill',
    fix: 'docs: fix the path the agent followed',
  },
  'check-failed': {
    tag: null,
    wrong: 'A check or search failed as part of normal work',
    fix: 'none',
  },
  unclassified: {
    tag: null,
    wrong: 'A tool call failed in a way no class matches',
    fix: 'judge: read the condensed trace',
  },
  'repeated-command': {
    tag: 'repeated-command',
    wrong: 'The same call ran twice in a row with nothing changed in between',
    fix: 'skill: read the failure before rerunning; `pnpm verify` prints the failing lines',
  },
  'e2e-rerun': {
    tag: 'e2e-rerun',
    wrong: 'The e2e suite was rerun after a failure instead of the one failing test',
    fix: 'docs: rerun one spec (`pnpm test:e2e <file>`) and read `pnpm verify` output first',
  },
  'scratch-outside': {
    tag: 'scratch-files-in-repo',
    wrong: 'A throwaway file was written into the repo instead of `.scratch/<session>/`',
    fix: 'check: `check:repo` forbidden-files already rejects it at commit; docs: AGENTS.md → Parallel sessions',
  },
  'scratch-dir-deleted': {
    tag: 'scratch-dir-deleted',
    wrong: 'The agent deleted the whole shared `.scratch/` folder',
    fix: 'environment: a deny rule for `rm -rf .scratch`',
  },
};

export const FAILURE_CLASSES: readonly FailureClass[] = [
  'worktree-guard',
  'env-file-denied',
  'permission-denied',
  'user-rejected',
  'commit-msg-hook',
  'pre-commit-hook',
  'missing-file',
  'check-failed',
  'unclassified',
];

const USER_REJECTED_RE = /doesn't want to proceed|user (rejected|declined|denied)/i;
const GUARD_RE =
  /was blocked\. For security|may only (change directories|access|read|write)|outside (of )?the (allowed )?working director|(cannot|could not) be (statically )?(analy[sz]ed|verified)/i;
const PERMISSION_RE =
  /has been denied|permission (was )?denied by|haven't granted it yet|(blocked|denied) by (the )?(auto[- ]mode )?classifier|requires approval/i;
const COMMIT_MSG_RE = /commitlint|subject-|header-max-length|scope-enum|type-enum|✖/;
const PRE_COMMIT_RE = /check:repo|check-repo|pre-commit/;
const MISSING_RE = /File does not exist|No such file or directory|ENOENT|cannot access/i;
const CHECK_COMMAND_RE =
  /\b(pnpm|npm|npx)\s+(?:run\s+|exec\s+)?(verify|test|typecheck|lint|check:repo|fix|vitest|tsc|eslint|playwright|prettier|eval:cv)|\b(vitest|tsc|eslint|playwright)\b/;
const SEARCH_COMMAND_RE = /^\s*(grep|rg|find|test|diff|git\s+(diff|grep))\b/;
const E2E_RE = /test:e2e|playwright\s+test/;
const SCRATCH_PATH_RE = /^(?:\.\/)?(?:tests\/e2e\/zz-|scripts\/[_.][\w-])/;
const SCRATCH_TARGET = String.raw`['"]?(?:[\w./-]*\/)?(?:tests\/e2e\/zz-|scripts\/[_.][\w-])`;
/** Writes by redirect, `tee`, `touch`, or as the target of `cp`/`mv`, on one line. */
const SCRATCH_SHELL_RE = new RegExp(
  String.raw`(?:>>?|\btee(?:\s+-a)?|\btouch)\s*${SCRATCH_TARGET}|\b(?:cp|mv)\s+[^\n|;&]*\s${SCRATCH_TARGET}`,
);
const SCRATCH_DELETE_RE = /\brm\s+-\w+\s+(?:\.\/)?\.scratch\/?(?=$|[\s;&|)])/m;

function inWorktree(session: Session): boolean {
  return session.cwd?.includes('/.claude/worktrees/') ?? false;
}

/** The one failure class of a failed tool call, checked in priority order. */
export function classifyFailure(event: ToolEvent, session: Session): FailureClass {
  const error = event.error ?? '';
  const command = shellCommand(event.input) ?? '';
  const subject = `${command} ${pathValues(event.input).join(' ')}`;
  if (USER_REJECTED_RE.test(error)) return 'user-rejected';
  if (GUARD_RE.test(error)) return 'worktree-guard';
  if (PERMISSION_RE.test(error)) {
    if (subject.includes('.env.local')) return 'env-file-denied';
    return inWorktree(session) ? 'worktree-guard' : 'permission-denied';
  }
  if (/\bgit\s+commit\b/.test(command)) {
    if (COMMIT_MSG_RE.test(error)) return 'commit-msg-hook';
    if (PRE_COMMIT_RE.test(error)) return 'pre-commit-hook';
  }
  if (CHECK_COMMAND_RE.test(command)) return 'check-failed';
  if (MISSING_RE.test(error)) return 'missing-file';
  if (SEARCH_COMMAND_RE.test(command)) return 'check-failed';
  return 'unclassified';
}

function behaviorsOf(
  event: ToolEvent,
  previous: ToolEvent | null,
  e2eFailedBefore: boolean,
  session: Session,
): BehaviorClass[] {
  const found: BehaviorClass[] = [];
  const command = shellCommand(event.input);
  if (
    previous &&
    previous.name === event.name &&
    JSON.stringify(previous.input) === JSON.stringify(event.input)
  ) {
    found.push('repeated-command');
  }
  if (command !== null && E2E_RE.test(command) && e2eFailedBefore) found.push('e2e-rerun');
  const writesScratch =
    (isWriteTool(event.name) &&
      pathValues(event.input).some((p) => SCRATCH_PATH_RE.test(relativeTo(p, session.cwd)))) ||
    (command !== null && SCRATCH_SHELL_RE.test(command.split('<<')[0] ?? ''));
  if (writesScratch) found.push('scratch-outside');
  if (command !== null && SCRATCH_DELETE_RE.test(command)) found.push('scratch-dir-deleted');
  return found;
}

/** Classifies every failed call and risky behavior of a session, and counts its metrics. */
export function gradeSession(session: Session, pr: number | null = null): GradedSession {
  const findings: Finding[] = [];
  const metrics: SessionMetrics = {
    toolCalls: 0,
    failed: 0,
    failuresByClass: {},
    behaviors: {},
    userTurns: 0,
    interruptions: 0,
  };
  let previous: ToolEvent | null = null;
  let e2eFailed = false;

  session.events.forEach((event, eventIndex) => {
    if (event.kind === 'user') metrics.userTurns += 1;
    if (event.kind === 'interrupt') metrics.interruptions += 1;
    if (event.kind !== 'tool') return;
    metrics.toolCalls += 1;
    for (const cls of behaviorsOf(event, previous, e2eFailed, session)) {
      findings.push({ cls, eventIndex });
      metrics.behaviors[cls] = (metrics.behaviors[cls] ?? 0) + 1;
    }
    if (event.error !== null) {
      const cls = classifyFailure(event, session);
      findings.push({ cls, eventIndex });
      metrics.failed += 1;
      metrics.failuresByClass[cls] = (metrics.failuresByClass[cls] ?? 0) + 1;
      if (E2E_RE.test(shellCommand(event.input) ?? '')) e2eFailed = true;
    }
    previous = event;
  });

  return { session, findings, metrics, pr };
}

/** Findings that become proposed `trace` rows (classes with a tag). */
export function taggedFindings(graded: GradedSession): Finding[] {
  return graded.findings.filter((f) => CLASSES[f.cls].tag !== null);
}
