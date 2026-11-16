# W5: /harden

**Status:** ⬜ · **Depends on:** W2

**Goal:** A command that promotes a repeated correction to a check: given a pattern from `docs/CORRECTIONS.md`, it adds the lint rule or repo check that prevents it, cleans up existing occurrences (or baselines them), and updates the enforcement map and the log. This is principle 2 of `docs/AUTOMATION.md`, as one step.

## Owns
- `.agents/skills/harden/SKILL.md`, `docs/CORRECTIONS.md` (statuses), `AGENTS.md` (point promotion at `/harden`), `docs/AUTOMATION.md` (mention in Principles)

## Scope (must cover)
- Input: a pattern tag from the log; with no argument, list patterns logged twice or more that aren't promoted or dismissed, and wait.
- Refuses a pattern with one occurrence unless it meets the high-stakes rule in `docs/CORRECTIONS.md`, and then asks first.
- Steps: find every existing occurrence; choose the strongest fix (design change, lint rule, repo check, test) and say why; write it with tests and a fix-naming message; fix occurrences or add them to the baseline; add or update the enforcement map row; set the log rows to `promoted: <check>`; commit with the right scope.
- Adds a prose-only rule only when no check is possible, and says why in the log row.

## Acceptance criteria
- [ ] Run on two real patterns logged twice; both end with a passing check that would have caught them and promoted log rows
- [ ] Run on a single-occurrence pattern; it declines and explains

## Out of scope

## Open questions

## Decisions

## Shared change requests
