# W5: /harden

**Status:** ⬜ · **Depends on:** W2

**Goal:** A command that turns a correction into a check: given what an agent got wrong, it adds the lint rule or repo check that prevents it, cleans up existing occurrences (or baselines them), and updates the enforcement map. This is the main loop from `docs/AUTOMATION.md` → Principles, as one step.

## Owns
- `.claude/commands/harden.md`, `AGENTS.md` (one line pointing corrections at `/harden`), `docs/AUTOMATION.md` (mention in Principles)

## Scope (must cover)
- Input: a free-text correction, or a PR review comment URL.
- Steps: find every existing occurrence; choose the strongest fix (design change, lint rule, repo check, test) and say why; write it with tests and a fix-naming message; fix occurrences or add them to the baseline; add or update the enforcement map row; commit `feat(workflow): ...` or the right scope.
- Refuses to add prose-only rules unless no check is possible, and then says why in the commit.

## Acceptance criteria
- [ ] Run on two real corrections from this repo's history; both end with a passing check that would have caught them

## Out of scope

## Open questions

## Decisions

## Shared change requests
