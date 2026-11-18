# W26: Production safety

**Status:** 🟨 · **Depends on:** W7

**Goal:** A change that breaks production is caught by something other than the owner trying the live site, and production changes go through a reviewed, repeatable path instead of throwaway scripts. After X4 merged, every signed-in save and history request in production failed with 401 because the API checked the wrong JWT issuer. The tests passed because their tokens made the same assumption.

## Owns
- `apps/api/src/middleware/auth.test.ts`, `apps/api/src/test/helpers.ts`, `tests/e2e/helpers.ts` (issuer only)
- `scripts/smoke.ts` with tests, `.github/workflows/smoke.yml`, `.github/workflows/migrate.yml`
- `docs/DEPLOYMENT.md`, `AGENTS.md` (Hard rules: one line on production changes), `README.md` (Commands)
- Branch protection on `main` (adding `Audit` to the required checks, with `gh api`, recorded in `docs/AUTOMATION.md`)

## Scope
- **Issuer contract test:**
  - A test that pins Neon Auth's documented token shape as literal fixtures: for `NEON_AUTH_BASE_URL=https://ep-x.neonauth.example/neondb/auth`, `iss` is `https://ep-x.neonauth.example` and the JWKS URL keeps the path.
  - It checks that `optionalAuth` accepts that token and rejects one with the full base URL as issuer.
  - The test helpers use the fixture constants instead of deriving the issuer the same way the code does, so a wrong assumption can't hide in both places.
- **Post-deploy smoke (`smoke.yml`):** on `deployment_status` success for the production deployments of `tablekeeper` and `tablekeeper-api`, run `scripts/smoke.ts` against the live URLs:
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
- [ ] `migrate.yml` waits for the owner's approval and, approved, reports "no pending migrations" on production (link the run)
- [ ] `AGENTS.md` → Hard rules has the production rule, and `docs/DEPLOYMENT.md` points at `migrate.yml`
- [ ] `Audit` is a required check on `main` (show the protection settings) (from W21)
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
- The issuer is derived in one exported function, `neonAuthEndpoints` (`apps/api/src/middleware/auth.ts`), which both test helpers call; `auth.test.ts` pins it to literal values in Neon Auth's documented shape. Helpers can't use fixed constants because test configs use other base URLs, so the guard is the pinned test, not separate code.

## Corrections

## Shared change requests
