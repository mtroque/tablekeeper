# W14: Nightly factory

**Status:** ⬜ · **Depends on:** W7, W11, W12, W16

**Goal:** Work moves without anyone at the keyboard: scheduled cloud agents take `agent-ready` issues, build each on a branch, open PRs, and auto-merge the categories `docs/AUTOMATION.md` → Auto-merge policy allows.

## Owns
- Schedules (Claude cloud routines and/or a local `agy` cron), `.agents/skills/` (an issue-to-PR command), GitHub labels and the auto-merge workflow, `docs/AUTOMATION.md` (policy and caps)

## Scope (must cover)
- Issue labels: `agent-ready`, `auto-merge-ok`, `needs-human`. An issue links a spec or carries its own acceptance list.
- Cloud environment setup: install, database (after X3, a local Postgres in the environment), env without production secrets.
- Daily caps per loop, run overnight; a run that hits a cap stops cleanly and comments on the issue.
- Auto-merge only with green required checks, the allowed category, and W12's revert rate under the threshold; otherwise the PR waits.
- Kill switch: one label or file that stops every loop.
- **Transcripts:** every unattended run saves its transcript where W16 reads it, and the nightly run grades the previous day's sessions (W16) before building. Unwatched runs are where silent workarounds hide; W1 to W3 were built in a runner whose transcripts weren't found locally, so none of that work could be graded.
- Cloud agents read only the repo's `.claude/settings.json`, so every allow rule they need (e.g. `pnpm preflight`) must be there, not in user settings.

## Acceptance criteria
- [ ] Three `agent-ready` issues become three PRs overnight; the allowed ones merge themselves, the others wait
- [ ] The kill switch stops the next run

## Out of scope

## Open questions
- Which loops run on Claude cloud vs `agy --remote-agent`? Measure one week of each against the quotas.
- How does each runner export its transcript (cloud routines, `agy`; headless Claude Code can write `--output-format stream-json`)?

## Decisions

## Shared change requests
