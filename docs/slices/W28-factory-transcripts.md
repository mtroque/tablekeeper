# W28: Factory transcripts and review memory

**Status:** ⬜ · **Depends on:** W27

**Goal:** Every agent run in the factory leaves a transcript that can be graded (W16), fix rounds build on each other, and the reviewer remembers earlier rounds. The rest of the 2026-11-18 first-run audit (W27 has the part that could be built locally).

## Owns
- `.github/workflows/factory.yml`, `.github/workflows/review.yml`, `scripts/factory/session.ts`, `scripts/review/` with tests
- `.claude/skills/review/SKILL.md` and `.agents/skills/review/SKILL.md` (prompt inputs only)
- `scripts/lib/verify/`, the `Checks` job in `.github/workflows/ci.yml` (actionlint only)
- Action versions in every `.github/workflows/*.yml`

## Scope
- **Fix rounds keep their sessions:** `review.yml` uploads the resumed session after each fix round (`session-<id>-r<round>`), and restore takes the latest round, so round 2 resumes round 1's work, not the original build.
- **The first review waits for the session:** `review.yml` starts when the PR opens, but `factory.yml` uploads the session only when the build ends, so the first review on PR #24 failed to download it. Wait (bounded) for the factory run on that branch to finish, or skip the fix round with a clear log line and let the next push retry.
- **Reviewer transcripts kept:** the reviewer runs with `--output-format stream-json` into a file, encrypted and uploaded like the builder's (`review-<pr>-r<round>`). Today its output is discarded, so its reasoning can't be graded.
- **Reviewer sees earlier rounds:** the prompt includes earlier findings and their `fixed in` and `disputed:` replies, so it doesn't raise them again (the deploy-wait race came up in 3 rounds), and lists what `pnpm check:repo` already enforces (it asked twice whether W26's criteria were moved).
- **actionlint in `pnpm verify` and CI:** the W26 builder downloaded actionlint mid-run, and review still found three `smoke.yml` bugs over three rounds.
- **Actions on Node 24:** every run warns that `checkout`, `setup-node`, `upload-artifact`, `create-github-app-token` and `pnpm/action-setup` run on deprecated Node 20; move each to its Node 24 major.
- **Live checks from W27:** a builder crash still uploads a transcript and comments on the issue; a ⏸ factory PR says `Refs #n` and its issue gets `needs-human`; a fix round's push doesn't cancel the running review.

## Acceptance criteria
- [ ] A two-round review keeps both fix-round sessions and both reviewer transcripts as artifacts that decrypt with the key (link the runs)
- [ ] The first review on a factory PR restores the builder session, or logs that it skipped the fix round and why
- [ ] A review round doesn't repeat a finding answered `fixed in` or `disputed:` in an earlier round (test on the prompt input; one live PR)
- [ ] `pnpm verify` and CI's `Checks` job run actionlint, and a broken workflow fails them
- [ ] No Node 20 deprecation warning on a factory, review or CI run
- [ ] The live checks moved from W27 pass on real runs (link them) (from W27)

## Tests
- Session restore picks the latest `-r<round>` artifact.
- The review prompt input lists earlier findings with their replies.

## Out of scope
- Grading the transcripts (W16). Merge authority (W19).

## Open questions
- **Workflow files (owner):** the factory App has no `workflows` permission, so W26 and W10 both staged workflows in `.github/workflow-drafts/` for the owner to move, and W26's round-2 fix came as a patch to apply by hand. Options: grant `workflows` to the App, with W19 never auto-merging a PR that touches `.github/workflows/` and review always marking it high risk; or keep drafts and add a `check:repo` rule that a draft can't be merged unmoved. Recommended: grant it with the W19 rule, since most W slices touch CI.
- **Reruns (owner):** the App can't rerun a failed job (`Resource not accessible by integration`); W26's E2E failed once when its Postgres container didn't start. Grant `actions: write`, or leave reruns to the owner.

## Decisions

## Corrections

## Shared change requests
