# W14: Nightly factory

**Status:** ⬜ · **Depends on:** W7, W11, W12

**Goal:** Work moves without anyone at the keyboard: scheduled cloud agents take `agent-ready` issues, build each on a branch, open PRs, and auto-merge the categories `docs/AUTOMATION.md` → Auto-merge policy allows.

## Owns
- Schedules (Claude cloud routines and/or a local `agy` cron), `.claude/commands/` (an issue-to-PR command), GitHub labels and the auto-merge workflow, `docs/AUTOMATION.md` (policy and caps)

## Scope (must cover)
- Issue labels: `agent-ready`, `auto-merge-ok`, `needs-human`. An issue links a spec or carries its own acceptance list.
- Cloud environment setup: install, database (after X3, a local Postgres in the environment), env without production secrets.
- Daily caps per loop, run overnight; a run that hits a cap stops cleanly and comments on the issue.
- Auto-merge only with green required checks, the allowed category, and W12's revert rate under the threshold; otherwise the PR waits.
- Kill switch: one label or file that stops every loop.

## Acceptance criteria
- [ ] Three `agent-ready` issues become three PRs overnight; the allowed ones merge themselves, the others wait
- [ ] The kill switch stops the next run

## Out of scope

## Open questions
- Which loops run on Claude cloud vs `agy --remote-agent`? Measure one week of each against the quotas.

## Decisions

## Shared change requests
