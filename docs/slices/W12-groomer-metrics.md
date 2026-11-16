# W12: Groomer and metrics

**Status:** ⬜ · **Depends on:** W2, W4

**Goal:** The codebase gets cleaner on its own: a scheduled loop takes the next item from the lint baselines and opens a small cleanup PR, and a metrics script shows whether agent work is getting better or worse.

## Owns
- `scripts/metrics.ts`, `.agents/skills/groom/SKILL.md`, the schedule definition (how it runs is recorded here), `docs/AUTOMATION.md` (metrics section)

## Scope (must cover)
- **Metrics:** from git and `gh`: PRs merged per week, revert rate (`revert` commits and reverted PRs over merged PRs), CI pass rate on first push, open baseline counts, and `docs/CORRECTIONS.md` patterns by count (flagging those at two or more that aren't promoted or dismissed). Printed as a short table.
- **Groomer:** picks the baseline entry with the fewest occurrences left, fixes it on a branch, opens a PR labeled `groomer`. One PR per run, capped per week.
- Runs on the cheapest pool that does the job well (see `docs/AUTOMATION.md` → Agents and budget); decide and record.

## Acceptance criteria
- [ ] `scripts/metrics.ts` prints the table for the last 4 weeks
- [ ] Two groomer runs produce two mergeable PRs with green CI

## Out of scope

## Open questions

## Decisions

## Shared change requests
