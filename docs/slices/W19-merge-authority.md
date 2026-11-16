# W19: Merge authority

**Status:** ⬜ · **Depends on:** W7, W11, W12

**Goal:** The reviewer can merge a PR or escalate it to the owner, but only inside limits a script enforces and a policy file sets. It starts in shadow mode, recording what it would have done. Each area's authority widens by changing one value once the record shows it agrees with the owner's own calls.

## Owns
- `.github/factory/merge-policy.json`, `scripts/factory/merge-policy.ts` (schema and decision), `scripts/factory/merge.ts` (acting on it) with tests
- `.github/workflows/merge.yml`, `.agents/skills/merge/SKILL.md` (a headless shared-docs step the workflow can call), `scripts/lib/metrics/` (the shadow agreement column)
- `docs/AUTOMATION.md` → Auto-merge policy

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
  - **auto:** the headless shared-docs step of `/merge` (roadmap status, decisions, corrections, spec cleanup) committed with the factory token, wait for checks, then `gh pr merge --rebase`.
  - **escalate:** label `needs-human` and a comment with the reasons that mentions the owner, so it reaches them through GitHub notifications.
- **Agreement:** a W12 column comparing each shadow decision with what happened (owner merged, changed it, or closed it), per group. It's the evidence for moving a group to `auto`.
- **Widening authority:** change a group's mode in the policy file in a PR; by the rule above, that PR always escalates.

## Acceptance criteria
- [ ] Over the first 20 factory PRs every decision is recorded in shadow mode, and the agreement rate shows in W12's table
- [ ] With the docs group set to `auto`, a docs-only factory PR merges itself, with the shared-docs commit; one that also touches shared code escalates
- [ ] A PR changing the policy file escalates even with every group set to `auto`
- [ ] A PR with a disputed finding or a red required check never merges, in any mode

## Tests
- `merge-policy.test.ts`: strictest group wins; unlisted file escalates; each fixed rule blocks on its own; each always-escalate path; thresholds per group override global ones.

## Out of scope
- Reviewing (W11). Merging owner PRs.

## Open questions
- Starting thresholds (lines, confidence, risk): set from the shadow record after the first 20 PRs, not guessed now.

## Decisions
- `AGENTS.md` and skills are in the always-escalate list as well as the factory's own files: they change how every agent behaves.

## Corrections

## Shared change requests
