# W7: CI database jobs

**Status:** 🟨 · **Depends on:** W1, X3

**Goal:** API integration tests and Playwright e2e tests run in CI against a real Postgres, so a PR can't break saving, quotas or a main flow without CI noticing. The factory (W14) reuses the same environment, and merge authority (W19) requires these jobs.

## Owns
- `.github/workflows/ci.yml` (new jobs only; the `Checks` job stays as it is), `playwright.config.ts` (CI-only settings), `README.md` (CI section), `docs/AUTOMATION.md` (the W7 row and the required-checks list in Target flow → Checks)

## Scope
- **Service:** `postgres:16-alpine` as a job service on port 54322 with database `tablekeeper`, matching `LOCAL_DATABASE_URL` (`scripts/lib/local-env.mjs`), so no new env plumbing. Then `pnpm db:reset` (migrations and `db/seed.sql`; a CI runner isn't a worktree, so the main-checkout guard doesn't apply). Rulebooks aren't in git; tests that need one already load a stand-in (`tests/e2e/S3.spec.ts`).
- **Job `API`:** `pnpm install --frozen-lockfile`, `db:reset`, then `pnpm exec vitest run --project api`.
- **Job `E2E`:** same setup plus `pnpm exec playwright install --with-deps chromium` (browsers cached by Playwright version), then `pnpm test:e2e` with `LLM_PROVIDER=fake`, the test-JWT auth X4 set up, and no production secrets. On failure, upload the Playwright report and traces (retention 7 days; they contain test data only).
- **Required checks:** add `API` and `E2E` to `main`'s branch protection with `gh api` and record the command in `docs/AUTOMATION.md` → Target flow → Checks.
- **Time:** record each job's time here. If `E2E` passes 15 minutes, shard it (`--shard`) across a matrix rather than cutting tests.
- `pnpm test:build` (S4 against a production build) stays local for now; note its time if tried in CI.

## Acceptance criteria
- [ ] A PR that breaks a session save fails `API`; one that breaks a main flow fails `E2E` (link both runs)
- [ ] Both jobs pass on `main`, with times recorded here
- [ ] `API` and `E2E` are required on `main` (show the protection settings)

## Tests
No new tests; this slice runs the existing ones in CI.

## Out of scope
- The factory workflow (W14), which copies this environment.

## Open questions

## Decisions
- The shared-auth-limit question is gone: since X4, e2e signs in with minted test JWTs instead of a local auth server, and the API burst limit is lifted in `playwright.config.ts`. If full runs fail in different tests from run to run, look for a shared limit first (transcript pass, 2026-11-16).
- Plain Postgres, not `supabase start`: X3 is done.

## Corrections

## Shared change requests
