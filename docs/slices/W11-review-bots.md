# W11: Review loop

**Status:** ⬜ · **Depends on:** W14

**Goal:** Every factory PR gets a model review, and the findings go back to the session that built it, so the fix is made with the builder's full context instead of by a fresh agent reading the diff cold.

## Owns
- `.github/workflows/review.yml`, `.agents/skills/review/SKILL.md` (the review prompt), `scripts/review/` (findings schema, posting, fix-round driver) with tests, `README.md`, `docs/AUTOMATION.md` → Review policy

## Scope (must cover)
- **Trigger:** `pull_request` (opened, synchronize) on `factory/*` branches. Other PRs only with the `review` label. One review per head commit; a `concurrency` group per PR.
- **Reviewer:** a separate headless session with the `reviewer` agent, model and effort from `.github/factory/config.json` (W14), by default a different model or effort from the builder. The prompt is `.agents/skills/review/SKILL.md`: the unchecked rows of the enforcement map, spec fit, the PR's verification list, and user-facing prose (no overclaiming or over-explaining). No restating lint.
- **Output:** structured findings (file, line, severity, summary, failure scenario) plus the verdict W19 uses (risk, confidence, recommendation, reasons), validated with Zod. Posted as a PR review with inline comments, which is the durable record.
- **Fix rounds:** when a finding meets the severity threshold, restore the builder's session from W14's session store and run `claude --resume <session> -p` with the findings. The builder answers each one as fixed or disputed (with a reason), pushes with the factory token, and its session is saved again; the push triggers the next review. At most `review.maxRounds` (config, default 2); after that, label `needs-human`.
- **PRs without a session** (human PRs, sessions past retention): findings are posted only.
- **Corrections:** accepted findings become `review` rows in the spec's `## Corrections`, so recurring ones reach `/harden`.

## Acceptance criteria
- [ ] A factory PR with a planted bug gets a finding; the resumed builder session (same session id) fixes it and the next review is clean
- [ ] A PR still failing review after `maxRounds` gets `needs-human`
- [ ] Re-running the workflow on the same head commit posts no duplicate review

## Out of scope
- Merging or escalating on the verdict (W19). Codex and Antigravity reviewers (later, through the same config, once their CLIs can sign in on a runner).

## Open questions
- Reviewer model and effort: compare two settings on the first five factory PRs and record.

## Decisions

## Corrections

## Shared change requests
