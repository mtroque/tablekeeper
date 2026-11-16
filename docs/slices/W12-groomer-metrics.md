# W12: Groomer and metrics

**Status:** ⬜ · **Depends on:** W2, W4

**Goal:** Two things that tell the factory how it's doing and give it small, safe work. Metrics show whether agent work is getting better or worse, and W19 reads the revert rate from them. The groomer turns lint-baseline leftovers into small issues in W14's queue instead of running a loop of its own.

## Owns
- `scripts/metrics.ts` and `scripts/lib/metrics/` with tests, `scripts/groom.ts` with tests
- `.github/workflows/metrics.yml` (weekly)
- `package.json` (`metrics` and `groom` scripts), `README.md` (Commands), `docs/AUTOMATION.md` (a Metrics section)

## Scope
- **`pnpm metrics [--weeks 4]`:** a table per ISO week from git and `gh`, deterministic, no model:
  - PRs merged, and how many came from `factory/*` branches
  - revert rate: merged PRs later reverted (a `revert` commit naming them, or a revert PR) over merged PRs; W19's ceiling reads this
  - CI pass rate on a PR's first push
  - factory: runs, tasks finished, `needs-human` rate, review rounds per PR (from W14 and W11 labels and comments, once they exist; empty columns until then)
  - lint baseline entries left (`eslint-rules/baseline.json`)
  - `docs/CORRECTIONS.md` patterns by count, flagging those at two or more that aren't promoted or dismissed (the `/harden` list)
  - Later slices add columns through `scripts/lib/metrics/`: W16 (trace failures per session), W19 (shadow agreement rate).
- **Weekly report:** `metrics.yml` runs every Monday and on demand, and updates one pinned issue "Factory metrics" with the table, so it's readable from a phone.
- **Groomer (`pnpm groom`):** for each baseline entry (rule and file), opens one issue labeled `groomer` and `agent-ready` with the rule, file, count and acceptance criterion "the entry is gone from the baseline and lint passes", added at the bottom of the "Factory" Project. It skips entries that already have an open issue. Issues it opens are machine-written, so `agent-ready` is safe. It runs at the end of `metrics.yml`, capped at 3 new issues a week. Building them is W14's job.
- The baseline is empty today, so the groomer has nothing to open until a new lint rule lands with a baseline; that's expected.

## Acceptance criteria
- [ ] `pnpm metrics` prints the table for the last 4 weeks with real numbers (paste it here)
- [ ] With a test baseline of two entries, `pnpm groom` opens two issues, and a second run opens none
- [ ] The pinned "Factory metrics" issue is updated by a manual run of `metrics.yml`

## Tests
- Revert detection (revert commit, revert PR, unrelated commit mentioning "revert"), week bucketing, pattern counting from a sample `CORRECTIONS.md`.
- Groomer: one issue per entry, idempotent, cap respected.

## Out of scope
- A dashboard beyond the pinned issue. Grading transcripts (W16).

## Open questions

## Decisions
- The groomer feeds W14's queue instead of running its own scheduled agent: one runner, one budget, one place to see what agents are doing.

## Corrections

## Shared change requests
