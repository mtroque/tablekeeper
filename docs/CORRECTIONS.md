# Tablekeeper: Corrections

Every time an agent is corrected (by you, by a review, or by noticing a broken rule itself), it's logged here first. A single correction is a data point, not a rule: it becomes a check only when the pattern repeats. This keeps the codebase from filling with one-off lint rules while still catching what keeps happening. How checks are chosen: `docs/AUTOMATION.md` → Principles.

## How to log

- **On `main`:** append a row below. **On any other branch:** add the row under `## Corrections` in your slice spec; `/merge` moves it here. Don't edit this file on a branch.
- **Pattern** is a short kebab-case tag naming the kind of mistake, not the instance (`env-outside-config`, not `detectors-ts-reads-env`). Reuse an existing tag when it fits; search this file first.
- **Source:** `user`, `review` (PR or bot review), or `self` (the agent found it).
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
