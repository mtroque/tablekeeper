# Tablekeeper: Corrections

Every time an agent is corrected (by you, by a review, or by noticing a broken rule itself), it's logged here first. A single correction is a data point, not a rule: it becomes a check only when the pattern repeats. This keeps the codebase from filling with one-off lint rules while still catching what keeps happening. How checks are chosen: `docs/AUTOMATION.md` → Principles.

## How to log

- **On `main`:** append a row below. **On any other branch:** add the row under `## Corrections` in your slice spec; `/merge` moves it here. Don't edit this file on a branch.
- **Pattern** is a short kebab-case tag naming the kind of mistake, not the instance (`env-outside-config`, not `detectors-ts-reads-env`). Reuse an existing tag when it fits; search this file first.
- **Source:** `user`, `review` (PR or bot review), `self` (the agent found it), or `trace` (found by grading session transcripts afterwards, including failures nobody corrected at the time).
- Log the correction even when it's fixed on the spot. Log what was wrong, not who.

## When a pattern becomes a check

- **Second occurrence** of the same pattern (in different slices or PRs): run `/harden` on it (W5), or note it as a candidate in the spec's `## Decisions` if that's beyond the slice. Set the rows' status to `promoted: <check>`.
- **First occurrence** only when the cost of it happening again is high: leaked secrets, lost or corrupted user data, a wrong saved score, a rule from `docs/games/` guessed instead of read. Propose the check to the user; don't add it unasked.
- **Dismiss** a pattern that turned out to be a misunderstanding or a one-off cause that no longer exists: status `dismissed: <why>`.
- Prose (a line in a doc) is the fallback only when no check is possible; say why in the row.

## Log

| Date | Pattern | Where | What was wrong | Correction | Source | Status |
|---|---|---|---|---|---|---|
| 2026-11-15 | `env-outside-config` | main | `process.env` read in `packages/core/src/games/_example/index.ts`, `apps/web/src/games/detectors.ts`, `apps/web/src/app/dev/cv/page.tsx` despite "only config reads env" | Fixed and enforced by `rules/no-env-outside-config` | self | promoted: `rules/no-env-outside-config` (W2) |
| 2026-11-15 | `disable-without-reason` | main | `eslint-disable-next-line` without a reason in `apps/web/src/components/corner-editor.tsx` | Fixed and enforced by `rules/require-disable-reason` | self | promoted: `rules/require-disable-reason` (W2) |
| 2026-11-16 | `scratch-files-in-repo` | 9 build sessions, worktrees and main | Agents wrote throwaway files into the repo (`tests/e2e/zz-shot.spec.ts`, `scripts/_debug.ts`, `scripts/.h2`, `scripts/.x2tmp`), none gitignored, because the worktree guard refused scratch work outside it | `.scratch/` gitignored and named in AGENTS.md → Parallel sessions | trace | promoted: `check:repo` forbidden-files (scratch paths) |
| 2026-11-16 | `worktree-command-refused` | 14 worktree sessions, 45 refusals | Claude Code refused heredocs, loops, variables in `sed`, inline python and `/tmp` paths in worktrees; agents retried silently, wasting calls in nearly every build | AGENTS.md → Parallel sessions: one plain command per call, edit tools, `.scratch/` | trace | promoted: AGENTS.md line (prose: the harness refuses these, a check can't see them) |
| 2026-11-16 | `preflight-reads-denied-file` | `/parallel` and `/build` sessions (10 sessions, 14 denials) | The `/parallel` preflight asked to confirm `.env.local` exists, but `.claude/settings.json` denies reading it (even `ls`); agents tried 2 or 3 variants each | `pnpm preflight` checks it without reading; skill and AGENTS.md point at it | trace | promoted: `pnpm preflight` |
| 2026-10-25 | `commit-msg-recovery` | main, session `3fd16127` | Commit hook rejected scope `readme`; the agent silently dropped the scope | Use a listed scope or ask to add one; say so in the report | trace | open |
| 2026-11-09 | `commit-msg-recovery` | main, session `2b6d37c6` | Commit hook rejected a 73-character header; the retry folded two planned commits into one whose message described only half of it, and it was pushed | Shorten the header and keep the planned commits | trace | open: candidate for `/harden` (W5) |
| 2026-10-25 | `overstated-user-notes` | main, session `3fd16127`, README | Submission note contradicted itself and claimed too much | User: "clean up the contradiction and the too strong note" | user | open |
| 2026-10-25 | `overstated-user-notes` | main, session `bce942eb`, README | Note over-explained ("no need to mention waking up the server", "keep that sentence concise but self-explained") | Trimmed on request | user | open: candidate for the W11 review prompt (no check possible) |
