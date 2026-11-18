# W11: Review loop

**Status:** 🟨 · **Depends on:** W14

**Goal:** Every factory PR gets a model review, and the findings go back to the session that built it, so the fix is made with the builder's full context instead of by a fresh agent reading the diff cold. The review's verdict is what W19 later uses to merge or escalate.

## Owns
- `.github/workflows/review.yml`, `.agents/skills/review/SKILL.md` (the review prompt)
- `scripts/review/` (findings schema, review posting, fix-round driver) with tests
- `.github/factory/config.json` (the `review` block only: `maxRounds`, `blockingSeverity`, `labels`)
- `README.md` (how to request a review), `docs/AUTOMATION.md` → Review policy

## Scope
- **Trigger:** `pull_request` (opened, synchronize, labeled) when the branch starts with `factory/`, or any PR with the `review` label. One review per head commit: the workflow skips a commit that already has a review from the factory identity. `concurrency` is one group per PR, so a new push supersedes a queued review.
- **Reviewer session:** a fresh headless run with the `reviewer` agent, model and effort from `.github/factory/config.json` (W14), in a checkout of the PR head with the workspace marked trusted (W14). It gets the PR diff, the linked spec, the PR's verification list and the CI results. The prompt (`.agents/skills/review/SKILL.md`) covers only what no check covers: the unchecked rows of the enforcement map, spec fit and acceptance criteria actually verified, user-facing prose (no overclaiming or over-explaining), and anything that looks wrong for players. It doesn't restate lint.
- **Output:** the reviewer writes JSON to `.scratch/review-<pr>/findings.json`, which `scripts/review/` validates with Zod. Each finding has file, line, severity (`blocking`, `should-fix`, `nit`), summary and failure scenario. The verdict for W19 has risk (`low`, `medium`, `high`), confidence (0 to 1), recommendation (`merge`, `fix`, `escalate`) and reasons. Invalid output gets one retry, then it's posted as a plain comment and labeled `needs-human`.
- **Posting:** one PR review through the GitHub API with inline comments on the lines and a summary body with the verdict, sent with the factory token. Earlier rounds' threads stay visible.
- **Fix rounds:** when any finding reaches `blockingSeverity` (default `should-fix`) and the PR has a session id in its body:
  1. Check out the PR branch at the same path the builder used (`/home/runner/work/tablekeeper/tablekeeper`), so the restored session matches.
  2. Restore the session with W14's helper and run `claude --resume <session> -p` with the findings and a short instruction: fix or dispute each one, run the checks the fix touches, commit, push.
  3. The builder replies on each thread as `fixed in <sha>` or `disputed: <reason>`. Disputed findings stay open and count toward W19's escalate rule.
  4. Save the session again (W14). The push triggers the next review, which reads the earlier threads.
  5. After `maxRounds` (default 2) with blocking findings still open, label `needs-human` and stop.
- **PRs without a session** (owner's PRs, sessions past artifact retention): findings are posted, with no fix round.
- **Corrections:** findings marked fixed become `review` rows in the spec's `## Corrections` (the builder adds them in its fix commit), so recurring ones reach `/harden`.

## Acceptance criteria
- [ ] A factory PR with a planted bug gets a blocking finding; the resumed builder session (same session id, and its reply shows it knows its spec) fixes it, and the next review has no blocking findings
- [ ] A PR still blocked after `maxRounds` gets `needs-human`, with no further rounds
- [ ] Re-running the workflow on the same head commit posts no second review
- [ ] An owner PR labeled `review` gets findings and no fix round

## Tests
- Findings schema: valid and invalid outputs, severity threshold logic, round counting from PR state.
- Posting: maps findings to review comments; a line outside the diff becomes a body item instead of failing.

## Out of scope
- Merging or escalating on the verdict (W19). Codex and Antigravity reviewers (later, through the same config, once their CLIs can sign in on a runner).

## Open questions
- Reviewer model and effort: compare two settings on the first five factory PRs (findings that held up versus noise) and record.

## Decisions

## Corrections

## Shared change requests
