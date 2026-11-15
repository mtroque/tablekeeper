# W11: Review bots

**Status:** ⬜ · **Depends on:** W4

**Goal:** PRs get a model review where it's worth the tokens, following `docs/AUTOMATION.md` → Review policy: Claude on request through the GitHub app, and Antigravity from a local script on the Google quota.

## Owns
- `.github/workflows/claude-review.yml`, `scripts/review-prs.sh` (or `.ts`), a shared review prompt (e.g. `.github/review-prompt.md`), `README.md`, `docs/AUTOMATION.md` → Review policy

## Scope (must cover)
- **Claude:** `anthropics/claude-code-action` with `CLAUDE_CODE_OAUTH_TOKEN`, on the `review:claude` label and on PRs touching shared code, posting inline comments. Never runs on every push.
- **Antigravity:** a script that lists open PRs without an `agy` review on their head commit, runs `agy -p --output-format json --json-schema <findings schema>` with the prompt and diff, and posts one comment per PR. Batches when it can (each call has about 10k tokens of overhead).
- **Prompt:** the unchecked rows of the enforcement map, spec fit, and the PR's acceptance list. No restating lint.
- **Feedback loop:** findings get a label or marker so recurring ones can be counted and sent to `/harden`.

## Acceptance criteria
- [ ] Labeling a PR gets a Claude review; an unlabeled game-only PR does not
- [ ] The script reviews every open PR once per head commit, run twice in a row without duplicate comments

## Out of scope

## Open questions
- Which `agy` model and effort for review (try Gemini 4 at medium against Claude Opus 5.5 through `agy` on two real PRs, record)?

## Decisions

## Shared change requests
