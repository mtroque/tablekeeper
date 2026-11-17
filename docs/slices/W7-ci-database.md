# W7: CI database jobs

**Status:** ✅ · **Depends on:** W1, X3

**Goal:** API integration tests and Playwright e2e tests run in CI against a real Postgres, so a PR can't break saving, quotas or a main flow without CI noticing. The factory (W14) reuses the same environment, and merge authority (W19) requires these jobs.

## Owns
- `.github/workflows/ci.yml` (new jobs only; the `Checks` job stays as it is), `playwright.config.ts` (CI-only settings), `apps/api/src/middleware/rate-limit.test.ts` (stand-in rulebook when uningested), `README.md` (CI section), `docs/AUTOMATION.md` (the W7 row and the required-checks list in Target flow → Checks)

## Scope
- **Service:** `postgres:16-alpine` as a job service on port 54322 with database `tablekeeper`, matching `LOCAL_DATABASE_URL` (`scripts/lib/local-env.mjs`), so no new env plumbing. Then `pnpm db:reset` (migrations and `db/seed.sql`; a CI runner isn't a worktree, so the main-checkout guard doesn't apply). Rulebooks aren't in git; tests that need one already load a stand-in (`tests/e2e/S3.spec.ts`).
- **Job `API`:** `pnpm install --frozen-lockfile`, `db:reset`, then `pnpm exec vitest run --project api`.
- **Job `E2E`:** same setup plus `pnpm exec playwright install --with-deps chromium` (browsers cached by Playwright version), then `pnpm test:e2e` with `LLM_PROVIDER=fake`, the test-JWT auth X4 set up, and no production secrets. On failure, upload the Playwright report and traces (retention 7 days; they contain test data only).
- **Required checks:** add `API` and `E2E` to `main`'s branch protection with `gh api` and record the command in `docs/AUTOMATION.md` → Target flow → Checks.
- **Time:** record each job's time here. If `E2E` passes 15 minutes, shard it (`--shard`) across a matrix rather than cutting tests.
- `pnpm test:build` (S4 against a production build) stays local for now; note its time if tried in CI.

## Acceptance criteria
- [x] A PR that breaks a session save fails `API`; one that breaks a main flow fails `E2E` (link both runs) — verified on PR #11 ([API](https://github.com/mtroque/tablekeeper/actions/runs/44123275638/job/134180098267), [E2E](https://github.com/mtroque/tablekeeper/actions/runs/44123275638/job/134180098022))
- [x] Both jobs pass on `main`, with times recorded here — passing on PR #11 ([run 44122408547](https://github.com/mtroque/tablekeeper/actions/runs/44122408547): `API` 53s, `E2E` 3m29s; `Checks` 1m40s); runs on `main` upon merge
- [x] `API` and `E2E` are required on `main` (show the protection settings) — `required_status_checks.contexts: ["Checks", "API", "E2E"]`, `strict: true`

## Tests
No new tests; this slice runs the existing ones in CI.

## Out of scope
- The factory workflow (W14), which copies this environment.

## Open questions

## Decisions
- The shared-auth-limit question is gone: since X4, e2e signs in with minted test JWTs instead of a local auth server, and the API burst limit is lifted in `playwright.config.ts`. If full runs fail in different tests from run to run, look for a shared limit first (transcript pass, 2026-11-16).
- Plain Postgres, not `supabase start`: X3 is done.
- `apps/api/src/middleware/rate-limit.test.ts` seeds a stand-in `patchwork` rulebook when none is loaded (matching `rules.test.ts`) so `API` passes in CI without ingested rulebooks and without racing against `rules.test.ts` (`azul`).
- `playwright.config.ts` uses `[['github'], ['html', { open: 'never' }]]` in CI so `playwright-report/` is generated alongside GitHub annotations for failure artifact uploads.
- CI timings on PR #11: `API` 53s, `E2E` 3m29s (well under the 15-minute threshold, so no sharding needed).

## Corrections

## Shared change requests
