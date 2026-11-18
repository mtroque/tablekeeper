# W26: Production safety

**Status:** ⏸ (built and tested; waiting on the owner: move `smoke.yml` and `migrate.yml` from `.github/workflow-drafts/` into `.github/workflows/` (the factory's App token can't push workflows) and merge, create the `production` environment and `DATABASE_URL_PRODUCTION`, add `Audit` to the required checks, and check sign-in, a signed-in save and history in production; commands in `docs/DEPLOYMENT.md` → 6 and `docs/AUTOMATION.md` → Target flow, step 4) · **Depends on:** W7

**Goal:** A change that breaks production is caught by something other than the owner trying the live site, and production changes go through a reviewed, repeatable path instead of throwaway scripts. After X4 merged, every signed-in save and history request in production failed with 401 because the API checked the wrong JWT issuer. The tests passed because their tokens made the same assumption.

## Owns
- `apps/api/src/middleware/auth.test.ts`, `apps/api/src/test/helpers.ts`, `tests/e2e/helpers.ts` (issuer only)
- `scripts/smoke.ts` with tests, `.github/workflows/smoke.yml`, `.github/workflows/migrate.yml` (staged as `.github/workflow-drafts/smoke.yml` and `.github/workflow-drafts/migrate.yml` until the owner moves them)
- `package.json` (the `smoke` script only), `scripts/db.mjs` (the `migrate` summary line only)
- `docs/DEPLOYMENT.md`, `AGENTS.md` (Hard rules: one line on production changes), `README.md` (Commands)
- Branch protection on `main` (adding `Audit` to the required checks, with `gh api`, recorded in `docs/AUTOMATION.md`)

## Scope
- **Issuer contract test:**
  - A test that pins Neon Auth's documented token shape as literal fixtures: for `NEON_AUTH_BASE_URL=https://ep-x.neonauth.example/neondb/auth`, `iss` is `https://ep-x.neonauth.example` and the JWKS URL keeps the path.
  - It checks that `optionalAuth` accepts that token and rejects one with the full base URL as issuer.
  - The test helpers use the fixture constants instead of deriving the issuer the same way the code does, so a wrong assumption can't hide in both places.
- **Post-deploy smoke (`smoke.yml`):** after each successful production deploy of `tablekeeper` and `tablekeeper-api` (a Vercel commit status on `main`; see Decisions), run `scripts/smoke.ts` against the live URLs:
  - `/health` and `/v1/games`;
  - `/v1/me` without a token is 401, not 500;
  - CORS allows the web origin.

  A failure opens an issue labeled `needs-human` with the failing check. Read-only, no production writes, no secrets beyond the URLs.
- **Signed-in smoke:** only with a dedicated smoke account (see Open questions). Without one, the smoke stays unauthenticated, and the owner's manual check after an auth change stays in the slice's acceptance criteria (W25 keeps it from being folded away).
- **Production migrations (`migrate.yml`):**
  - `workflow_dispatch` only, in a GitHub `production` environment that requires the owner's approval.
  - It runs `node scripts/db.mjs migrate` with the `DATABASE_URL_PRODUCTION` environment secret (unpooled), and prints which migrations it applied.
  - `docs/DEPLOYMENT.md` replaces the manual `DATABASE_URL=… node scripts/db.mjs migrate` step with it.
- **Rule:** agents never run commands against production (migrations, env changes, data) from local scripts or `.scratch/`. They use a workflow, or write the exact command for the owner to run. This is one line in `AGENTS.md` → Hard rules.

## Acceptance criteria
- [x] The issuer test fails against the pre-PR #8 issuer logic and passes now: with the issuer set back to the full base URL, all 3 tests in `apps/api/src/middleware/auth.test.ts` fail; restored, all 3 pass (W20 branch)
- [ ] A production deploy triggers `smoke.yml`, which passes (link the run); a smoke against a wrong URL opens a `needs-human` issue
  - Before merge: `pnpm smoke` against production passes 5 of 5; against `--api https://tablekeeper-beryl.vercel.app/wrong` it fails 4 checks by name and exits 1; actionlint passes. The live run and the issue need the workflow on `main`.
- [ ] `migrate.yml` waits for the owner's approval and, approved, reports "no pending migrations" on production (link the run)
  - Before merge: `node scripts/db.mjs migrate` on a fresh local database prints the 6 `Applied` lines and `Applied 6 of 6 migrations.`, then `No pending migrations (6 applied).` on a second run; actionlint passes. The run needs the workflow on `main` and the owner's environment setup.
- [x] `AGENTS.md` → Hard rules has the production rule, and `docs/DEPLOYMENT.md` points at `migrate.yml` (Hard rules line names `migrate.yml`; `docs/DEPLOYMENT.md` → Migrations, step 1.2 and Local development point at it; no `DATABASE_URL=<prod` command left)
- [ ] `Audit` is a required check on `main` (show the protection settings) (from W21)
  - The factory token gets 403 on branch protection; the owner runs the command in `docs/AUTOMATION.md` → Target flow, step 4.
- [ ] The owner confirms production sign-in, a signed-in save and history after the W21 dependency changes deploy (from W21)

## Tests
- `auth.test.ts`: documented issuer accepted, base-URL issuer rejected, expired token rejected.
- `scripts/smoke.ts`: each check against a local API (pass) and a stub returning 500 (fail with the check's name).

## Out of scope
- Load testing. Monitoring beyond the smoke.

## Open questions
- A signed-in smoke needs a production account the workflow can sign in as. Google OAuth can't be automated safely; enabling Neon Auth email sign-in just for a smoke user widens the login surface. Owner to decide: no signed-in smoke (default), or a smoke user with its own sign-in method.

## Decisions
- Done early on the W20 branch: the issuer contract test and the production rule in `AGENTS.md` → Hard rules. Still open: smoke, `migrate.yml`, the `docs/DEPLOYMENT.md` change, and the two criteria from W21.
- **Smoke trigger is `status`, not `deployment_status`:** Vercel reports this repo's deploys as commit statuses ("Vercel – tablekeeper", "Vercel – tablekeeper-api"); the repo has no GitHub Deployments (`GET /repos/mtroque/tablekeeper/deployments` is `[]`), so `deployment_status` would never fire. `smoke.yml` runs on a successful `Vercel – <project>` status (not `Vercel Preview Comments`) for a commit that is a head of `main` (production), plus `workflow_dispatch` with optional URLs. Each deploy reports two statuses, so the job first waits (up to 15 minutes) until neither project's status for that commit is pending, which keeps a run from smoking a half-deployed pair (review finding on PR #24). A merge can still run the smoke twice; runs for the same commit queue (job-level concurrency, so skipped status events never take the group), and a second failure comments on the open issue instead of opening another.
- **Smoke checks:** `web` (home page HTML), `health`, `games`, `me-unauthenticated` (401 `UNAUTHENTICATED`, not 500), `cors` (preflight from the web origin allowing `authorization`, the header signed-in requests need). 20s timeout per request, no retries. URLs default to `https://tablekeeper-api.vercel.app` (read from the live web bundle) and `https://tablekeeper-beryl.vercel.app`, overridable with repo variables `SMOKE_API_URL` and `SMOKE_WEB_URL`.
- **No signed-in smoke** (the open question's default): no production smoke account exists, and the owner's manual check after an auth change stays in `docs/DEPLOYMENT.md` → Smoke test (by hand).
- **`migrate.yml`:** `workflow_dispatch` on `main` only (the job is skipped from any other ref), `production` environment (owner approval, protected branches only), one run at a time. `scripts/db.mjs migrate` now ends with `No pending migrations (<n> applied).` or `Applied <k> of <n> migrations.` so the run log answers the criterion. The step fails with a pointer to the setup if `DATABASE_URL_PRODUCTION` is empty, instead of falling back to the local default URL.
- **Workflow files as drafts:** the push of `.github/workflows/*.yml` was refused ("refusing to allow a GitHub App to create or update workflow ... without `workflows` permission"), so both files are on the branch under `.github/workflow-drafts/` with a two-line header; the owner moves them and deletes the header before merging. No other credential was tried. The factory App either gets the `workflows` permission or keeps escalating workflow changes this way (`docs/AUTOMATION.md` → Auto-merge policy already escalates them).
- **Factory git identity:** the runner had no git user, so commits are authored as `tablekeeper-factory[bot]` (`358178244+tablekeeper-factory[bot]@users.noreply.github.com`), set in the repo's local git config only. `factory.yml` should set it (W24's area).
- **Owner-only settings:** the factory's App token gets 403 on branch protection, repo variables and environments, so it can't add `Audit` to the required checks or create the environment. Those are written as exact owner commands (`docs/AUTOMATION.md` → Target flow, step 4; `docs/DEPLOYMENT.md` → 6), per the production rule.
- The issuer is derived in one exported function, `neonAuthEndpoints` (`apps/api/src/middleware/auth.ts`), which both test helpers call; `auth.test.ts` pins it to literal values in Neon Auth's documented shape. Helpers can't use fixed constants because test configs use other base URLs, so the guard is the pinned test, not separate code.

## Corrections

| Date | Pattern | Where | What was wrong | Correction | Source | Status |
|---|---|---|---|---|---|---|
| 2026-11-18 | `assumed-external-behavior` | W26 spec | The spec triggered the smoke on `deployment_status`, but Vercel posts commit statuses on this repo and creates no GitHub Deployments, so the workflow would never have run (same kind of miss as X4's assumed JWT issuer) | Checked the repo's deployments and commit statuses; `smoke.yml` triggers on `status` | self | open |
| 2026-11-18 | `deploy-race` | W26, `smoke.yml` draft | The smoke ran on the first Vercel success, possibly while the other project was still deploying | Waits until no `Vercel – ` status for the commit is pending | review | open |

## Shared change requests
