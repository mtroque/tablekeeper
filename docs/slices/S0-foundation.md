# S0: Foundation

**Status:** ⏸ · **Depends on:** none

**Paused (2026-10-25):** local Supabase for this repo can't start: another local Supabase project (`~/supabase-warmup`) holds the default ports 54321 to 54327, and stopping it needs the owner's OK. Everything is built; still to run against the database: `pnpm db:start && pnpm db:reset && pnpm db:types` (replaces the hand-written placeholder `apps/api/src/db/database.types.ts`), the API integration tests (`/v1/me`, RLS), the signed-in e2e test, and a manual Google sign-in with the OAuth client in `.env.local`.

**Goal:** a running, tested skeleton that every later slice plugs into without touching shared plumbing: monorepo, web + API + database, Google sign-in and guest mode, game library and hub, every table and every shared type.

## Owns
Everything. After S0, `packages/core/src/kit/types.ts` and the migration are frozen; later changes go through shared change requests.

## Scope

**Repo and tooling**
- The workspace and folders in `docs/ARCHITECTURE.md` → Monorepo; `packages/cv` gets build/test wiring only. Tooling per `docs/CONVENTIONS.md`.
- Root scripts for every command in `README.md` (`ingest`, `eval:cv` and `rules:smoke` may print "not implemented yet").
- Commit rules per `docs/CONVENTIONS.md` → Git: commitlint config with the scope list, a commit-msg hook (`simple-git-hooks`, installed on `pnpm install`), and `pnpm lint:commits` (commits since `main` on a branch; since `origin/main`, or the last commit, on `main`).
- The copy lint rule from `docs/CONVENTIONS.md` → Web, with tests for dashes, emoji and banned phrases.
- `scripts/lib/local-env.mjs`, used by `scripts/dev.mjs` (`pnpm dev`), the Vitest and Playwright configs, and every script that talks to the database:
  - **Supabase:** for each of `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` that isn't already set, fill it from `supabase status -o env` (`API_URL`; `ANON_KEY` or `PUBLISHABLE_KEY`; `SERVICE_ROLE_KEY` or `SECRET_KEY`). Explicit values always win. If local Supabase isn't running and a value is missing, exit with "Local Supabase isn't running. Run pnpm db:start." Never print the keys.
  - **Ports:** `WEB_PORT` / `API_PORT` if set, else the first free ports from 3000 / 4000; set `NEXT_PUBLIC_API_URL` and `WEB_ORIGINS` to match.
  - `pnpm dev` then starts web and API and prints the URLs.
- `.env.local` at the repo root is loaded by `local-env.mjs` (values already in the environment win) and by `pnpm db:start`, so the Google OAuth variables reach `supabase start`.
- `pnpm db:start` and `pnpm db:reset` refuse to run inside a worktree (AGENTS.md → Parallel sessions).

**Database:** one migration with every table, trigger and RLS policy in `docs/ARCHITECTURE.md` → Data model. `seed.sql` adds local email/password test users: `e2e@local` plus one per game (`e2e-<gameId>@local`). Supabase config enables Google via env (`SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID`, `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET`) and allows `/auth/callback` on `http://localhost` ports 3000 to 3009. Generated types go to `apps/api/src/db/database.types.ts` (`pnpm db:types`).

**core**
- `kit/types.ts`: every core-side type in ARCHITECTURE → Game modules (`GameDefinition`, `ScoreBreakdown`, `CellRef`, `Detector`, `Draft`), plus `GameId`, `Point`, `Quad`, `ConfidenceMap`, `ImageInput`, `DetectOptions`, `Session`, `SessionSummary`, `SessionInput`, `Campaign`, `Result`. `GameUiModule` and its props types are React types, so they live in `apps/web/src/games/types.ts`.
- `games/<gameId>/index.ts` for all four games: name, edition, official rulebook URL (from `docs/games/<gameId>.md`), `features`, three `rulesStarters`, placeholder `stateSchema` (`z.unknown()`), `stateVersion: 0`. `games/registry.ts` imports them.
- Features follow `docs/PRODUCT.md` → Games and features: every game has rules and a scorer; Patchwork and Harmonies have photo scoring; only Dorfromantik has a campaign.
- Contracts: errors, health, games, me.

**api:** `config.ts`, `app.ts` / `server.ts`, all middleware in ARCHITECTURE → Monorepo, a per-request Supabase client plus a service-role client, and the routes `GET /health`, `GET /v1/games`, `GET /v1/me`.

**web**
- Tailwind with the UX tokens and fonts; shadcn initialized (Button, Sheet, Dialog, Tabs, Toast, Skeleton) and restyled per `docs/UX.md` → Look and voice.
- `AppShell` per `docs/UX.md` → Desktop, with sign-in / avatar menu (Google via Supabase, `/auth/callback`).
- `/` game library from the local registry (works with the API down); `/games/[gameId]/*` hub with `GameTabs` and "Coming Soon" tabs.
- `games/<gameId>/index.ts` per game with a `GameUiModule` holding only its `Motif` (per `docs/UX.md` → Visuals), imported by `games/registry.ts`. Every `GameUiModule` member except `Motif` is optional, since game slices add them.
- `lib/api-client.ts` (bearer token, error envelope, one retry for cold starts); `SessionStore` interface only; `lib/cv-client.ts` with its final signature that returns `{ ok: false, error: 'unavailable' }` until S2 replaces it.
- Fire-and-forget `GET /health` on load.

## UI states
- Header while the auth session loads: a skeleton in place of the sign-in button.
- Server status line (all screens): "Waking up the server." with a hint while `/health` is slow; "Couldn't reach the server." with Retry if it fails; "You're offline." when the browser is offline. The library always renders.
- Account sheet: display name from `/v1/me` (skeleton while loading, email if it fails) and "Sign Out".
- Sign-in callback: "Signing you in." while exchanging the code; on failure "Couldn't finish signing in." with "Try Again".
- Unknown `gameId`: Next.js not-found page with a link back to the library.

## Acceptance criteria
- [ ] Fresh clone → `pnpm install && pnpm db:start && pnpm db:reset && pnpm dev` gives a working app and API, with no Supabase values in `.env.local`. (Not run yet: database blocked. `pnpm install` and `pnpm dev` with explicit Supabase values work.)
- [x] With local Supabase stopped, `pnpm dev` exits with the "isn't running" message; an explicit `SUPABASE_URL` in the environment overrides the detected one. (Manual run; `scripts/lib/local-env.test.js`.)
- [x] The library shows the four games with correct feature tags; each hub shows the right tabs. (`tests/e2e/S0.spec.ts`, `apps/web/src/lib/game-tabs.test.ts`.)
- [ ] Google sign-in and sign-out work locally. (Sign In reaches Supabase's Google authorize URL with the right `redirect_to`, e2e; sign-out tested with a seeded user once the database runs; the Google round trip needs a manual run.)
- [ ] `GET /v1/me` returns the 401 envelope without a token and the profile with one.
- [ ] User A can't read user B's `play_sessions` (integration test).
- [x] At 1440px: centered column with QR side note; at 390px: no side note. (e2e, plus screenshots checked in light and dark.)
- [x] A second `pnpm dev` in another checkout picks the next free ports with no env edits. (Manual: a second checkout got 3001 / 4001 while the first ran on 3000 / 4000.)
- [x] A commit message like `added stuff` is rejected by the hook; `pnpm lint` fails on a UI string containing an em dash. (Manual runs; `eslint-rules/ui-copy.test.js`.)

## Tests
core registry and contracts; API health, games, auth paths, error envelope, RLS; e2e library → hub and a signed-in state with a seeded user.

## Out of scope
Sessions API, CV, LLM, game logic.

## Open questions
None open. Resolved from the docs:
- Feature flags per game: `docs/PRODUCT.md` → Games and features (Azul has no photo scoring, D-017).
- `/v1/me` contract: `{ id, displayName, email }`, from `profiles` plus the auth user.
- Example game (`NEXT_PUBLIC_ENABLE_EXAMPLE_GAME`): S1 owns it; S0 only parses the variable.

## Decisions
- TypeScript is pinned to 6.0: typescript-eslint doesn't support TypeScript 7 yet.
- Workspace packages ship TypeScript source. Next.js transpiles them (`transpilePackages`); the API is bundled with tsup for Render.
- Package boundaries are enforced twice: by package name (`@typescript-eslint/no-restricted-imports`, which also allows cv's type-only imports of core) and by relative path (`import-x/no-restricted-paths`).
- `GameUiModule` and its props types live in `apps/web/src/games/types.ts` (they need React). Every member except `Motif` is optional, since game slices add them.
- The browser uses plain `supabase-js` with PKCE and the session in localStorage (`tk:auth`); there is no server-side auth, because data goes through the API with a bearer token. E2E tests sign seeded users in by password and put the session under that key.
- `game_id` columns are checked against an id pattern, not the four ids, so S1's `_example` game can be saved in tests; the API validates ids against the registry.
- `pnpm db:start` and `pnpm db:reset` refuse to run in a worktree, since every worktree shares one database.
- CORS is a small local middleware rather than the `cors` package.

## Shared change requests
None.
