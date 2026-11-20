# W29: Merge authority live

**Status:** ⬜ · **Depends on:** W19

**Goal:** W19's merge authority runs on real factory PRs: first in shadow, recording a decision on each, then with thresholds and the first `auto` group set from that record. W19 built and unit-tested the policy, decision and actions; everything here needs live PRs or owner setup.

## Owns
- `.github/workflows/merge.yml` (moving `.github/workflow-drafts/merge.yml`), `.github/factory/merge-policy.json`
- `docs/AUTOMATION.md` → Auto-merge policy

## Scope
- **Owner setup:** move `.github/workflow-drafts/merge.yml` to `.github/workflows/merge.yml` and delete its two-line header (the factory's App token can't push workflows). Optionally run it once by hand on an open factory PR (`workflow_dispatch`, `dry_run` on) to see the decision in the log.
- **Shadow record:** let the first 20 factory PRs collect decisions. Check that each has the decision comment and a `shadow:*` label, and that `pnpm metrics` (and the pinned "Factory metrics" issue) shows the agreement per week and per group.
- **Thresholds:** set `maxChangedLines`, `minConfidence` and `maxRisk` from the shadow record (sizes, confidences and risks of the PRs where shadow and owner agreed), not guessed.
- **First `auto` group:** the group with the best agreement (likely `docs`) moves to `auto` in a PR, which escalates by design.

## Acceptance criteria
- [ ] The owner moved the workflow, and a factory PR got the decision comment and a `shadow:*` label after its CI and Review runs completed (link the run)
- [ ] Over the first 20 factory PRs every decision is recorded in shadow mode, and the agreement rate shows in W12's table (moved from W19; shown in the metrics report's merge authority section, per week and per group)
- [ ] Thresholds are set from the shadow record, with the numbers behind them written here
- [ ] Live: with the `docs` group set to `auto`, a docs-only factory PR merges itself, and one that also touches shared code escalates with `needs-human` (W19 verified this with `decide()` and `planActions()` tests)
- [ ] Live: an `auto` PR that is behind `main` is rebased by its builder session, then merges after its checks pass again

## Tests
None beyond W19's; this slice is live verification and policy values.

## Out of scope
- Changing the decision rules (W19's `scripts/factory/merge-policy.ts`).

## Open questions
None yet.

## Decisions

## Corrections

## Shared change requests
