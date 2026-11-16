# X4: Sign-in with Neon Auth

**Status:** 🟨 · **Depends on:** X3

**Goal:** Move Google sign-in from Supabase Auth to Neon Auth, so users live in the same Neon database and Supabase leaves the stack entirely. Guests notice nothing; signed-in users sign in again once (fresh start).

## Owns
- `apps/web/src/lib/auth.ts`, `apps/web/src/lib/supabase.ts` (removed), `apps/web/src/lib/env.ts`, `apps/web/src/lib/api.ts`, `apps/web/src/lib/api-client.ts`, `apps/web/src/components/auth-provider.tsx`, `apps/web/src/components/account-menu.tsx`, `apps/web/src/app/auth/callback/page.tsx`, `apps/web/package.json`
- `apps/api/src/middleware/auth.ts`, `apps/api/src/config.ts`, `apps/api/src/config.test.ts`, `apps/api/src/db/client.ts`, `apps/api/src/llm/setup.ts`, `apps/api/src/routes/`, `apps/api/src/test/helpers.ts`, `apps/api/src/vercel.test.ts`, `apps/api/package.json`
- `db/migrations/`, `db/seed.sql`, `supabase/` (removed)
- `scripts/db.mjs`, `scripts/dev.mjs`, `scripts/preflight.mjs`, `scripts/lib/local-env.mjs`, `scripts/lib/local-env.d.mts`, `scripts/lib/local-env.test.js`, `scripts/lib/test-users.mjs`, `scripts/lib/test-users.d.mts`
- `tests/e2e/helpers.ts`, `tests/e2e/S0.spec.ts`, `tests/e2e/S1.spec.ts`, `tests/e2e/A1.spec.ts`, `tests/e2e/D1.spec.ts`, `tests/e2e/D2.spec.ts`, `tests/e2e/H1.spec.ts`, `tests/e2e/P1.spec.ts`, `tests/e2e/X3.spec.ts`, `tests/e2e/X4.spec.ts`
- `.github/workflows/ci.yml`, `.env.example`, `.gitignore`, `.prettierignore`, `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `vitest.config.ts`, `playwright.config.ts`
- `AGENTS.md`, `README.md`, `docs/ARCHITECTURE.md`, `docs/CONVENTIONS.md`, `docs/DEPLOYMENT.md`, `docs/PRODUCT.md`, `docs/UX.md`, `apps/web/src/app/privacy/page.tsx`

## Scope
- **Sign-in flow.** Replace `@supabase/supabase-js` in `apps/web` with `@neondatabase/auth` (`createAuthClient` pointed at `NEXT_PUBLIC_NEON_AUTH_URL`). `signInWithGoogle` calls `auth.signIn.social({ provider: 'google', callbackURL: '/auth/callback' })` after saving the return path in `sessionStorage` (`RETURN_TO_KEY`). `/auth/callback` calls `getSession()` (which exchanges Neon Auth's `neon_auth_session_verifier` if present), runs `resumePendingSave()` if a guest save is pending, and redirects back.
- **API verification.** Replace `auth.getUser(token)` in `apps/api/src/middleware/auth.ts` with `jose` (`createRemoteJWKSet` over `${NEON_AUTH_BASE_URL}/.well-known/jwks.json` and `jwtVerify` with `issuer` check). In `NODE_ENV=test` (when `AUTH_TEST_SECRET` is set), also verify HS256 JWTs signed with `AUTH_TEST_SECRET` so API and e2e tests run offline without a hosted Neon Auth branch. Extract `sub` (UUID), `email`, and `name` from the JWT payload, ensure the `profiles` row exists, and attach the user-scoped `Db` client.
- **Migration.** Add `db/migrations/20261116180000_neon_auth.sql` pointing `profiles.id`, `campaigns.user_id`, and `play_sessions.user_id` at `neon_auth."user"(id) on delete cascade`. `scripts/db.mjs` creates a minimal `neon_auth."user"` table in local Postgres if the schema isn't present (Neon creates it automatically when Neon Auth is enabled).
- **Local dev and e2e.** `scripts/db.mjs` manages a local Docker Postgres container (`tablekeeper-postgres` on port `54322`, `postgres:16-alpine`) instead of `supabase start`. `scripts/lib/local-env.mjs` provides `DATABASE_URL` and local test defaults (`AUTH_TEST_SECRET`, `NEON_AUTH_BASE_URL`, `NEXT_PUBLIC_NEON_AUTH_URL`) when unset. E2E helpers mint test JWTs signed with `AUTH_TEST_SECRET` and store `{ token, user }` under `tk:auth` in `localStorage` (superseding D-022: production uses Neon Auth HTTP-only cookies; `tk:auth` is used for local test sessions).
- **Removal.** Remove `@supabase/supabase-js`, `supabase/`, all Supabase env vars, and every Supabase reference in docs, config, scripts, and `/privacy` (outside git history and `docs/DECISIONS.md`).

## UI states
None new. `/privacy` updates "Services Used" and "Logs and Storage" to reflect Neon Auth (HTTP-only session cookie, no Supabase) and updates its "Last updated" date.

## Acceptance criteria
- [ ] Signing in with Google on production creates a Neon Auth user and a profile, and a saved play shows in history. Ready for production: `20261116180000_neon_auth.sql` applied on Neon `tablekeeper-db`, Google OAuth and trusted domains configured in Neon Console, `NEXT_PUBLIC_NEON_AUTH_URL` set on `tablekeeper` (production and preview). Needs live Google sign-in verification after deploy
- [x] A guest result saved during sign-in lands in the account after the redirect (`tests/e2e/X4.spec.ts` and `tests/e2e/S1.spec.ts` pass)
- [x] The API rejects missing, expired and foreign-issuer tokens with `UNAUTHENTICATED` (`apps/api/src/routes/me.test.ts`: 6 tests pass)
- [x] Every e2e spec that signs in passes with the new test-user sign-in (`pnpm test:e2e`: 38 passed, covering `S0`, `S1`, `A1`, `D1`, `D2`, `H1`, `P1`, `X3`, `X4`)
- [x] No `supabase` dependency, folder, env var or doc mention remains (`supabase/` removed, `@supabase/supabase-js` removed from all `package.json`, `git grep -in supabase` clean outside `docs/DECISIONS.md`, `docs/CORRECTIONS.md`, `db/migrations/20261116120000_neon_database.sql`, `pnpm-lock.yaml`, and past/W slice specs)

## Tests
- `apps/api/src/routes/me.test.ts`: test missing token, malformed header, invalid token, expired token, foreign-issuer token (`UNAUTHENTICATED` 401), and valid token creating the profile.
- `tests/e2e/X4.spec.ts`: tests the `/auth/callback` pending-save handoff for a guest result during sign-in and verifies the saved game opens in history.
- All existing e2e specs that sign in (`S0`, `S1`, `A1`, `D1`, `D2`, `H1`, `P1`, `X3`) pass using minted test JWTs.

## Out of scope
- Other sign-in providers; importing Supabase users.

## Open questions
Resolved:
- **Local tests:** mint HS256 JWTs in test mode with `AUTH_TEST_SECRET`, accepted by `optionalAuth` only when `NODE_ENV === 'test'` and `AUTH_TEST_SECRET` is set. Keeps `pnpm test` and `pnpm test:e2e` completely offline.
- **OAuth callback:** `@neondatabase/auth`'s `getSession()` handles `neon_auth_session_verifier` on `/auth/callback`, keeping `resumePendingSave()` and `RETURN_TO_KEY` intact.

## Decisions
- Web auth uses `@neondatabase/auth` (`BetterAuthVanillaAdapter`) pointed at `NEXT_PUBLIC_NEON_AUTH_URL`. Production uses Neon Auth HTTP-only session cookies (`getSession()` / `token()`), superseding D-022; local e2e tests mint HS256 JWTs signed with `AUTH_TEST_SECRET` into `localStorage` under `tk:auth`.
- API auth (`apps/api/src/middleware/auth.ts`) verifies JWTs with `jose` (`createRemoteJWKSet` against `${NEON_AUTH_BASE_URL}/.well-known/jwks.json`, `issuer` checked). In `NODE_ENV=test` only, HS256 tokens signed with `AUTH_TEST_SECRET` are also accepted so tests run offline.
- Local database runs in Docker (`tablekeeper-postgres`, `postgres:16-alpine` on port `54322`) managed by `scripts/db.mjs`, with `neon_auth."user"` stubbed locally so `20261116180000_neon_auth.sql` FKs work offline.
- New dependencies: `jose` in `apps/api` and root `devDependencies`; `@neondatabase/auth` in `apps/web` (`core-js` build script disabled in `pnpm-workspace.yaml`).

## Corrections

## Shared change requests
