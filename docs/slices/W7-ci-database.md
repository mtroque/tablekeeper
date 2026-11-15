# W7: CI database jobs

**Status:** ⬜ · **Depends on:** W1, X3

**Goal:** API integration tests and Playwright e2e tests run in CI against a real database, so a PR can't break saving, quotas or a main flow without CI noticing.

## Owns
- `.github/workflows/ci.yml` (new jobs), CI-only env setup, `playwright.config.ts` (CI settings only), `README.md`, `docs/AUTOMATION.md` (W7 row)

## Scope (must cover)
- A Postgres service container (after X3), migrations and seed applied, then the `api` vitest project and `pnpm test:e2e` with `LLM_PROVIDER=fake`.
- Playwright traces and screenshots uploaded as artifacts on failure.
- The jobs become required checks (update W4's list).
- Total CI time recorded; split or shard e2e if it passes 15 minutes.

## Acceptance criteria
- [ ] A PR that breaks a session save fails the API job; one that breaks a main flow fails e2e (show runs)
- [ ] Both jobs pass on `main`, with times recorded here

## Out of scope

## Open questions
- If X3 slips: run `supabase start` in CI now (Docker is available on GitHub runners) and switch to plain Postgres after X3?

## Decisions

## Shared change requests
