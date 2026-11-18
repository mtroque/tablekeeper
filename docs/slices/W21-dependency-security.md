# W21: Dependency security

**Status:** ⬜ · **Depends on:** none

**Goal:** No known high or critical advisory ships in production dependencies, and CI says so on every PR instead of an agent seeing a warning and moving on. As of 2026-11-18, `pnpm audit --prod` reports 1 critical, 2 high, 2 moderate and 2 low, all on the sign-in path or the web framework.

## Owns
- `apps/web/package.json`, `pnpm-workspace.yaml` (`overrides`), `pnpm-lock.yaml`
- `.github/workflows/ci.yml` (an `Audit` job), `package.json` (`audit` script), `README.md` (Commands)
- `docs/AUTOMATION.md` (enforcement map row; required checks)

## Scope
- **Upgrade:**
  - `next` to `>=16.4.5` (two cache-leak advisories in `'use cache'` functions). This also ends `next dev`'s agent upgrade notice, which stopped e2e runs in 2 sessions.
  - `better-auth` to `>=1.7.7` and `zod` to `>=4.6.6`. Both come only through `@neondatabase/auth` (`0.7.0-beta` pins `better-auth` 1.7.6 and `zod` 4.5.4), so force them with `overrides` in `pnpm-workspace.yaml` until Neon releases a version that doesn't need it. Each override gets a comment naming the advisory and the condition for removing it.
  - Record which advisories reach our code. The critical and high `better-auth` ones concern server-side OAuth proxy and magic-link handling, which Neon Auth runs, not our client bundle. `zod`'s concerns validating oversized collections; our own `zod` is already 4.6.7.
- **CI:**
  - An `Audit` job running `pnpm audit --prod --audit-level high`, required on `main`.
  - The weekly `metrics.yml` run also reports moderate and low counts as a column, so they're seen without blocking PRs.
  - An advisory with no fix can be ignored only through `pnpm.auditConfig.ignoreGhsas` with a comment and a date to revisit.
- **Verify sign-in:** sign-in libraries changed, so after deploy the owner confirms Google sign-in, a signed-in save and history on production. This is the X4 check, repeated.

## Acceptance criteria
- [ ] `pnpm audit --prod --audit-level high` passes locally and in the `Audit` job (link the run)
- [ ] `pnpm typecheck && pnpm lint && pnpm test && pnpm test:e2e` pass with the new versions, and the first e2e run doesn't stop on Next's upgrade notice
- [ ] `Audit` is a required check on `main` (show the protection settings)
- [ ] The owner confirms production sign-in, a signed-in save and history after deploy

## Tests
No new tests; the existing suites cover the upgraded paths.

## Out of scope
- Automated dependency update PRs (Renovate or Dependabot). Revisit once W19 can merge patch bumps.

## Open questions

## Decisions

## Corrections

## Shared change requests
