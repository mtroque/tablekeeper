# W19: Merge authority

**Status:** 🟨 · **Depends on:** W7, W11, W12

**Goal:** The reviewer can merge a PR or escalate it to the owner, but only inside limits a script enforces and a policy file sets. It starts in shadow mode, recording what it would have done. Each area's authority widens by changing one value once the record shows it agrees with the owner's own calls.

## Owns
- `.github/factory/merge-policy.json`, `scripts/factory/merge-policy.ts` (schema and decision), `scripts/factory/merge.ts` (acting on it), `scripts/factory/merge-github.ts` (reading PR state), `scripts/factory/merge-policy.test.ts`
- `.github/workflows/merge.yml` (staged as `.github/workflow-drafts/merge.yml` until the owner moves it: the factory's App token can't push workflows)
- `scripts/lib/metrics/` (the shadow agreement column), `scripts/metrics.ts` (reading the decision records)
- `docs/AUTOMATION.md` → Auto-merge policy, Metrics, Accounts and setup; `README.md` (the `merge:decide` command), `package.json` (`merge:decide` script)
- `docs/slices/W27-merge-authority-live.md` (the follow-up holding the criteria that need live PRs)

## Scope
- **Policy file** (`.github/factory/merge-policy.json`, Zod-validated). Path groups and their starting mode, all `shadow`:

  | Group | Paths |
  |---|---|
  | docs | `docs/**`, `README.md` (not `docs/games/**`) |
  | game rules | `docs/games/**`, `packages/core/src/games/**` |
  | game UI and CV | `apps/web/src/games/**`, `packages/cv/src/games/**`, `data/fixtures/**`, `apps/web/public/samples/**` |
  | shared code | `packages/core/src/{kit,contracts}/**`, `packages/cv/src/pipeline/**`, `apps/web/src/{components,lib,app}/**` |
  | API | `apps/api/src/**` except the next two groups |
  | LLM gateway | `apps/api/src/llm/**`, `apps/api/src/rules/**` |
  | auth | `apps/api/src/middleware/auth.ts`, `apps/web/src/lib/auth.ts`, `apps/web/src/app/auth/**` |
  | migrations | `db/**` |
  | tests and tooling | `tests/**`, `scripts/**` except `scripts/factory/**`, `eslint-rules/**` |
  | dependencies | `package.json`, `*/package.json`, `pnpm-lock.yaml` |

  Each group has a mode (`shadow`, `auto` or `escalate`). Global thresholds, overridable per group: max changed lines (excluding lockfile and fixtures), minimum reviewer confidence, highest allowed risk. Revert-rate ceiling: 2%, from W12. A PR takes the strictest mode of the groups it touches; a file in no group counts as `escalate`.
- **Fixed rules a model can't override:**
  - required checks green (`Checks`, W7's `API` and `E2E`, W9's `CV`)
  - W11's review loop finished with no open blocking or disputed findings
  - the reviewer recommended `merge`
  - revert rate under the ceiling
  - the PR came from a `factory/*` branch (owner PRs are the owner's to merge)
- **Always escalate, whatever the policy says:** a PR that changes `.github/factory/`, `.github/workflows/`, `.agents/skills/`, `.claude/settings.json`, `AGENTS.md` or `scripts/factory/`. The reviewer must never widen its own authority, and the instructions every agent follows deserve a human look.
- **Decision:** `decide(policy, pr, checks, verdict, revertRate)` is a pure function returning `merge`, `wait` or `escalate`, with every reason that applied. Unit tested rule by rule.
- **`merge.yml`:** runs when W11's review workflow completes (`workflow_run`) and on check-suite completion for factory PRs. It computes the decision and acts:
  - **shadow:** a comment with the decision and reasons, and the label `shadow:merge` or `shadow:escalate`. The owner merges as usual.
  - **auto:** if the PR is behind `main`, ask the builder's session to rebase (W11's resume path) and wait for checks again; then `gh pr merge --rebase` with the factory token. The shared docs are already in the PR's finish commit (AGENTS.md → Definition of done).
  - **escalate:** label `needs-human` and a comment with the reasons that mentions the owner, so it reaches them through GitHub notifications.
- **Agreement:** a W12 column comparing each shadow decision with what happened (owner merged, changed it, or closed it), per group. It's the evidence for moving a group to `auto`.
- **Widening authority:** change a group's mode in the policy file in a PR; by the rule above, that PR always escalates.

## Acceptance criteria
- [ ] Over the first 20 factory PRs every decision is recorded in shadow mode, and the agreement rate shows in W12's table (moved to W29)
- [x] With the docs group set to `auto`, a docs-only factory PR merges itself; one that also touches shared code escalates (`merge-policy.test.ts`: `decide()` gives `merge` in `auto` mode and `planActions()` plans the comment and `gh pr merge`, or a rebase first when behind `main`; adding `apps/web/src/components/counter.tsx` gives `escalate` with `group-shadow`, planned as a mention plus `needs-human`. The live run is W29's)
- [x] A PR changing the policy file escalates even with every group set to `auto` (`merge-policy.test.ts`: the policy file alone, and one sample per always-escalate pattern, each `escalate` with every group `auto`)
- [x] A PR with a disputed finding or a red required check never merges, in any mode (`merge-policy.test.ts`: each required check red, and one disputed finding, give `escalate` with every group `auto`, `shadow` and `escalate`, also while checks still run; `pnpm merge:decide --pr 33` on the open W16 PR read its 4 unresolved `disputed:` threads from GitHub and escalated)

## Tests
- `merge-policy.test.ts`: strictest group wins; unlisted file escalates; each fixed rule blocks on its own; each always-escalate path; thresholds per group override global ones.

## Out of scope
- Reviewing (W11). Merging owner PRs.

## Open questions
None left. Resolved from the docs:
- **Starting thresholds** (lines, confidence, risk): `null` (no limit) in the policy file, set from the shadow record after the first 20 PRs (W27), not guessed now. Thresholds only matter once a group is `auto`.
- **Strictest mode:** `auto` < `shadow` < `escalate`. A PR whose groups are all `shadow` is recorded only. A PR touching an `auto` group acts live: anything else it touches that is still `shadow` escalates it (the owner must not assume the bot handles it). An `escalate` group, an unlisted file or an always-escalate path escalate live in every mode.
- **Order of outcomes:** hard escalations (red required check, disputed or open blocking finding, `needs-human`, not a factory branch) win; otherwise anything still pending (checks, review) makes it `wait`; then the remaining escalations; otherwise `merge`. So a path or threshold escalation is only raised once checks and review are done, and the first final decision is on a reviewed, green commit.
- **Review state:** the latest factory review (`REVIEW_MARKER`) on the head commit gives the verdict (parsed from its `### Verdict:` line) and its findings at or above `blockingSeverity`. No review on the head commit, or a Review run still in progress for the branch, is `wait`. Blocking findings on the head commit with no Review run in progress means the fix round ended without a push: escalate. An unresolved review thread with a reply starting `disputed:` is a disputed finding.
- **Revert rate:** over the last 50 merged PRs (`revertWindow`), with W12's `extractRevertedPrs`.
- **Triggers:** `workflow_run` on the `CI` and `Review` workflows completing. `check_suite` doesn't fire for check suites GitHub Actions creates, so CI completion comes through `workflow_run` too. Plus `workflow_dispatch` with a PR number and `dry_run`.
- **Agreement:** each decision is recorded in the PR's decision comment (hidden JSON history, one entry per head commit and decision). The first shadow `merge` or `escalate` is compared with the outcome: merged at that same commit (`merged`), merged after more commits (`changed`), or closed unmerged (`closed`). `merge` agrees with `merged`; `escalate` agrees with `changed` or `closed`.

## Decisions
- `AGENTS.md` and skills are in the always-escalate list as well as the factory's own files: they change how every agent behaves. The list is in code (`ALWAYS_ESCALATE_PATHS`), not the policy file, and adds `.github/workflow-drafts/` and `.claude/skills/` (the symlink) to the spec's list.
- **Mixed modes:** a PR touching an `auto` group acts live, so any `shadow` group it also touches escalates it for real (rule `group-shadow`) rather than being recorded quietly: once an area has authority, the owner must not assume the bot handles a PR it can't merge. A PR whose groups are all `shadow` is recorded only.
- **Reading the review:** the verdict is parsed from the `### Verdict:` line `scripts/review/post.ts` writes, and findings from the `**[severity]**` tags in the head commit's review body and inline comments, so `scripts/review/` didn't need a machine-readable field.
- **Triggers:** `workflow_run` on `CI` and `Review`, not `check_suite`, which doesn't fire for suites GitHub Actions creates. The job checks out `main`, so a PR can't change the policy that judges it.
- **Agreement placement:** the agreement is its own section at the end of `pnpm metrics` (per week and per group, `scripts/lib/metrics/agreement.ts`), not a column inside `format.ts`'s weekly table, because W16 (PR #33, also owning `scripts/lib/metrics/`) is changing `format.ts` at the same time. `scripts/metrics.ts` gets one reader and one print line.
- **Workflow as a draft:** `merge.yml` is staged in `.github/workflow-drafts/` for the owner to move, as W10 and W16 did; no push to `.github/workflows/` was attempted. Moving it, and the live criteria, are W29.
- **Follow-up id:** W29, because W27 and W28 are taken by open PR #32.

## Corrections
| Date | Pattern | Where | What was wrong | Correction | Source | Status |
|---|---|---|---|---|---|---|
| 2026-11-20 | `slice-id-taken-in-open-pr` | W19, follow-up spec | The next free slice id on `main` (W27) was already used, with W28, by open PR #32; only `gh pr list` showed it | Took W29 after checking open PRs; candidate check: `check:repo` or `/plan` warns when a new spec id is in an open PR's files | self | open |
| 2026-11-20 | `ownership-overlap` | W19 and W16 (PR #33) | Both specs own `scripts/lib/metrics/`, both PRs change `scripts/metrics.ts`, and they were built at the same time, which AGENTS.md → Parallel sessions forbids | W19 kept to a new file and two additive lines in `scripts/metrics.ts`; candidate check: the factory queue skips an issue whose spec's `## Owns` overlaps an open PR's | self | open |

## Shared change requests
