export type Runner = 'claude' | 'agy';

export type ToolEvent = {
  kind: 'tool';
  name: string;
  /** Short argument for the condensed trace (first line of a command, a relative path). */
  arg: string;
  /** Raw input, kept in memory for classification only. */
  input: Record<string, unknown>;
  /** Error text when the call failed, else null. */
  error: string | null;
};

export type TraceEvent =
  | { kind: 'user'; text: string }
  | { kind: 'interrupt' }
  | ToolEvent
  | { kind: 'final'; text: string };

/** One agent session, condensed from a transcript: user turns, tool calls, errors, final message. */
export type Session = {
  id: string;
  runner: Runner;
  startedAt: string | null;
  endedAt: string | null;
  cwd: string | null;
  branch: string | null;
  models: string[];
  tokens: { input: number; output: number };
  events: TraceEvent[];
};

export type FailureClass =
  | 'worktree-guard'
  | 'env-file-denied'
  | 'permission-denied'
  | 'user-rejected'
  | 'commit-msg-hook'
  | 'pre-commit-hook'
  | 'missing-file'
  | 'check-failed'
  | 'unclassified';

export type BehaviorClass =
  'repeated-command' | 'e2e-rerun' | 'scratch-outside' | 'scratch-dir-deleted';

export type TraceClass = FailureClass | BehaviorClass;

export type Finding = { cls: TraceClass; eventIndex: number };

export type SessionMetrics = {
  toolCalls: number;
  failed: number;
  failuresByClass: Partial<Record<FailureClass, number>>;
  behaviors: Partial<Record<BehaviorClass, number>>;
  userTurns: number;
  interruptions: number;
};

export type GradedSession = {
  session: Session;
  findings: Finding[];
  metrics: SessionMetrics;
  pr: number | null;
};

export type JudgeResult = {
  rubric: string;
  label: string;
  pass: boolean;
  note: string;
};

export type JudgedSession = {
  id: string;
  reason: 'flagged' | 'sample';
  results: JudgeResult[] | null;
  tokens: number;
};
