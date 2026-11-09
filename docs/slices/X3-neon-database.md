# X3: Database on Neon

**Status:** ⬜ · **Depends on:** X2

**Goal:** Move Postgres from Supabase to Neon (Vercel Marketplace), with the API using a plain SQL driver instead of supabase-js and PostgREST, so the database sits next to the Vercel-hosted API and one fewer platform is needed. Sign-in stays on Supabase Auth until X4.

## Owns
- `apps/api/src/db/` (client, every query module, `database.types.ts` replaced by typed rows, `rls.test.ts`), `apps/api/src/config.ts`, `apps/api/src/types/express.d.ts`, `apps/api/package.json`
- The Supabase-client wiring in `apps/api/src/app.ts` and the API test helpers (`apps/api/src/test/helpers.ts`, route tests that call `service.rpc`)
- `supabase/migrations/` moves to a plain migrations folder (e.g. `db/migrations/`) with one new migration that drops the `auth.*` dependencies; `scripts/db.mjs`, `scripts/lib/local-env.mjs` and its test, `scripts/lib/test-users.mjs`, `scripts/ingest-rulebook.ts`, `scripts/rules-smoke.ts`
- `tests/e2e/helpers.ts` (seeding only), `tests/e2e/X3.spec.ts`
- `docs/ARCHITECTURE.md` (overview diagram, data model RLS paragraph, Auth bullet's database half), `docs/DEPLOYMENT.md`, `.env.example`, `README.md` (`db:*` commands), `docs/PRODUCT.md` → Privacy page (Services row), `apps/web/src/app/privacy/page.tsx`

## Scope (must cover)
- **Driver.** `@neondatabase/serverless` (or `postgres` if the pool works better on Fluid compute; decide and record) with a small typed query layer. No ORM unless a few lines won't do.
- **Access control in the API.** Every user-owned query filters by the verified user id; the API connects as one role. RLS stays on as a backstop: each request sets `app.user_id` (transaction-local) and policies read it instead of `auth.uid()`. `rls.test.ts` keeps proving a user can't read or write another user's rows.
- **SQL functions kept.** `start_campaign`, `search_rulebook_sections`, `replace_rulebook`, `llm_consume_request`, `llm_record_tokens`, `rate_limit_hit`, `rate_limit_undo` are called with plain `select`; full-text search (generated tsvector, GIN) is unchanged.
- **Users without `auth.users`.** `profiles.id` and the `user_id` columns stop referencing `auth.users`; the profile row is created by the API on first authenticated request (replacing the sign-up trigger). X4 points them at Neon Auth's users.
- **Burst limit store** (D-073) renamed off Supabase, same behavior.
- **Local dev and worktrees.** One local Postgres for all worktrees (Docker), started from the main checkout as today; `pnpm db:start | db:reset | db:types` keep their names and rules. Migration runner chosen and recorded.
- **Production.** Neon via Vercel Marketplace linked to the API project, region next to the API function. Fresh start: schema pushed, rulebooks re-ingested, no data copied from Supabase. Cutover steps in `docs/DEPLOYMENT.md`.

## Acceptance criteria
- [ ] No package in `apps/api` or `scripts` imports `@supabase/supabase-js` for database access
- [ ] `pnpm db:reset` builds the local database from migrations and seed; `pnpm db:start` and `db:reset` still refuse to run in a worktree
- [ ] Every existing API integration test passes against the new layer, and `rls.test.ts` shows cross-user reads and writes fail both in the API and at the database
- [ ] A signed-in user's first request creates their profile; saving a play and a campaign works end to end (`tests/e2e/X3.spec.ts`)
- [ ] Production API on Vercel talks to Neon: `/health`, a guest rules question, and a signed-in save all work, with timings recorded here
- [ ] Docs and the privacy page name Neon instead of Supabase for the database

## Out of scope
- Replacing Supabase Auth (X4).
- Copying production data from Supabase.

## Open questions
- Driver: `@neondatabase/serverless` over WebSockets vs `postgres` over TCP on Fluid compute; which keeps cold requests fastest?
- Migration runner: plain SQL files with a tiny runner, or a tool (dbmate, node-pg-migrate)?
- Local DB: Docker Postgres, or a Neon dev branch per developer? (Docker keeps tests offline.)
- Do e2e tests need a fake JWT issuer once Supabase's local stack is gone, or does X3 keep the local Supabase only for Auth until X4?

## Decisions

## Shared change requests
