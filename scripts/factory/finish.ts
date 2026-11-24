// What the factory does after a build opened a PR (W27): a slice whose spec is still on the
// branch isn't finished (it's ⏸), so its PR must not close the issue.

/** The status after `**Status:**` in a spec, without the `· **Depends on:**` part. */
export function specStatusLine(spec: string): string {
  const match = /\*\*Status:\*\*\s*(.*?)(?:\s+·\s+\*\*Depends on:\*\*.*)?$/m.exec(spec);
  return match?.[1]?.trim() || 'not finished';
}

export type PausedFollowUp = {
  /** The PR body with `Closes #n` (and Fixes or Resolves) turned into `Refs #n`. */
  body: string;
  bodyChanged: boolean;
  /** Why the issue needs a human: the spec's status line. */
  reason: string;
};

/**
 * For a slice whose spec is still on the PR's branch (`spec` not null), the PR body references
 * the issue instead of closing it, and the issue is handed to a human with the spec's status.
 * A folded slice (`spec` null) needs nothing.
 */
export function pausedSliceFollowUp(
  body: string,
  issueNumber: number,
  spec: string | null,
): PausedFollowUp | null {
  if (spec === null) return null;
  const closing = new RegExp(
    `\\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\\s+#${issueNumber}\\b`,
    'gi',
  );
  const next = body.replace(closing, `Refs #${issueNumber}`);
  return { body: next, bodyChanged: next !== body, reason: specStatusLine(spec) };
}
