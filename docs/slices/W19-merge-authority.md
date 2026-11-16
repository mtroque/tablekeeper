# W19: Merge authority

**Status:** ⬜ · **Depends on:** W7, W11, W12

**Goal:** The reviewer can merge a PR or escalate it to the owner, but only inside limits a script enforces and a policy file sets. It starts in shadow mode, recording what it would have done, and each area's authority widens by changing one value once the record shows it agrees with the owner.

## Owns
- `.github/factory/merge-policy.json`, `scripts/factory/merge-policy.ts` (schema and decision) with tests, `.github/workflows/merge.yml`, `docs/AUTOMATION.md` → Auto-merge policy

## Scope (must cover)
- **Policy file:** named path groups (globs) such as docs, game folders, shared code, scorers, LLM gateway, migrations, auth and workflow, each with a mode: `shadow`, `auto` or `escalate`. Thresholds: max changed lines, minimum reviewer confidence, highest allowed risk, and W12's revert-rate ceiling. A PR takes the strictest mode of the groups it touches. Every group starts as `shadow`.
- **Fixed rules a model can't override:** required checks green, including W7's e2e job; the review loop finished with no open findings above the threshold; revert rate under the ceiling.
- **Always escalate, whatever the policy says:** a PR that changes the policy file, the review prompt or skills, `.github/workflows/`, `.claude/settings.json` or `scripts/factory/`. The reviewer must never be able to widen its own authority.
- **Decision:** a pure function of the policy, the PR's changed files and line counts, check results and the reviewer's verdict, returning merge, wait or escalate with reasons. Unit tested per rule.
- **Shadow:** comment the decision and label `shadow:merge` or `shadow:escalate`; the owner merges as usual. W12's metrics show how often the shadow decision matched what the owner did.
- **Auto:** run the shared-doc step of `/merge` headless, then rebase-merge with the factory token.
- **Escalate:** label `needs-human` and comment with the reasons, mentioning the owner so it reaches them through GitHub notifications.

## Acceptance criteria
- [ ] Over the first 20 factory PRs every decision is recorded in shadow mode, and the agreement rate is in W12's table
- [ ] With one group set to `auto`, a PR touching only that group merges itself; one also touching shared code escalates
- [ ] A PR changing the policy file escalates even when every group is `auto`

## Out of scope

## Open questions
- Starting thresholds (lines, confidence, risk): set from the shadow record, not guessed.

## Decisions

## Corrections

## Shared change requests
