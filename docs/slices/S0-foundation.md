# S0: Foundation

**Status:** ⬜ · **Depends on:** none

**Goal:** a running, tested skeleton that every later slice plugs into without touching shared plumbing: monorepo, web + API + database, Google sign-in and guest mode, game library and hub, every table and every shared type.

## Owns
Everything. After S0, `packages/core/src/kit/types.ts` and the migration are frozen; later changes go through shared change requests.

## Scope

**Repo and tooling**
- The workspace and folders in `docs/ARCHITECTURE.md` → Monorepo; `packages/cv` gets build/test wiring only. Tooling per `docs/CONVENTIONS.md`.
- Root scripts for every command in `README.md` (`ingest` and `eval:cv` may print "not implemented yet").
- Commit rules per `docs/CONVENTIONS.md` → Git: commitlint config with the scope list, a commit-msg hook (`simple-git-hooks`, installed on `pnpm install`), and `pnpm lint:commits` (commits since `main` on a branch; since `origin/main`, or the last commit, on `main`).
- The copy lint rule from `docs/CONVENTIONS.md` → Web, with tests for dashes, emoji and banned phrases.
- `scripts/lib/local-env.mjs`, used by `scripts/dev.mjs` (`pnpm dev`), the Vitest and Playwright configs, and every script that talks to the database:
  - **Supabase:** for each of `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` that isn't already set, fill it from `supabase status -o env` (`API_URL`; `ANON_KEY` or `PUBLISHABLE_KEY`; `SERVICE_ROLE_KEY` or `SECRET_KEY`). Explicit values always win. If local Supabase isn't running and a value is missing, exit with "Local Supabase isn't running. Run pnpm db:start." Never print the keys.
  - **Ports:** `WEB_PORT` / `API_PORT` if set, else the first free ports from 3000 / 4000; set `NEXT_PUBLIC_API_URL` and `WEB_ORIGINS` to match.
  - `pnpm dev` then starts web and API and prints the URLs.

**Database:** one migration with every table, trigger and RLS policy in `docs/ARCHITECTURE.md` → Data model. `seed.sql` adds local email/password test users: `e2e@local` plus one per game (`e2e-<gameId>@local`). Supabase config enables Google via env (`SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID`, `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET`) and allows `/auth/callback` on `http://localhost` ports 3000 to 3009.

**core**
- `kit/types.ts`: every type in ARCHITECTURE → Game modules, plus `Point`, `Quad`, `ConfidenceMap`, `ImageInput`, `DetectOptions`, `Session`, `SessionSummary`, `SessionInput`, `Campaign`, `Result`.
- `games/<gameId>/index.ts` for all four games: name, edition, official rulebook URL (from `docs/games/<gameId>.md`), `features`, three `rulesStarters`, placeholder `stateSchema` (`z.unknown()`), `stateVersion: 0`. `games/registry.ts` imports them.
- Contracts: errors, health, games.

**api:** `config.ts`, `app.ts` / `server.ts`, all middleware in ARCHITECTURE → Monorepo, a per-request Supabase client plus a service-role client, and the routes `GET /health`, `GET /v1/games`, `GET /v1/me`.

**web**
- Tailwind with the UX tokens and fonts; shadcn initialized (Button, Sheet, Dialog, Tabs, Toast, Skeleton) and restyled per `docs/UX.md` → Look and voice.
- `AppShell` per `docs/UX.md` → Desktop, with sign-in / avatar menu (Google via Supabase, `/auth/callback`).
- `/` game library from the local registry (works with the API down); `/games/[gameId]/*` hub with `GameTabs` and "Coming Soon" tabs.
- `games/<gameId>/index.ts` per game with a `GameUiModule` holding only its `Motif` (per `docs/UX.md` → Visuals), imported by `games/registry.ts`.
- `lib/api-client.ts` (bearer token, error envelope, one retry for cold starts); `SessionStore` interface only; `lib/cv-client.ts` with its final signature that returns `{ ok: false, error: 'unavailable' }` until S2 replaces it.
- Fire-and-forget `GET /health` on load.

## Acceptance criteria
- [ ] Fresh clone → `pnpm install && pnpm db:start && pnpm db:reset && pnpm dev` gives a working app and API, with no Supabase values in `.env.local`.
- [ ] With local Supabase stopped, `pnpm dev` exits with the "isn't running" message; an explicit `SUPABASE_URL` in the environment overrides the detected one.
- [ ] The library shows the four games with correct feature tags; each hub shows the right tabs.
- [ ] Google sign-in and sign-out work locally.
- [ ] `GET /v1/me` returns the 401 envelope without a token and the profile with one.
- [ ] User A can't read user B's `play_sessions` (integration test).
- [ ] At 1440px: centered column with QR side note; at 390px: no side note.
- [ ] A second `pnpm dev` in another checkout picks the next free ports with no env edits.
- [ ] A commit message like `added stuff` is rejected by the hook; `pnpm lint` fails on a UI string containing an em dash.

## Tests
core registry and contracts; API health, games, auth paths, error envelope, RLS; e2e library → hub and a signed-in state with a seeded user.

## Out of scope
Sessions API, CV, LLM, game logic.
