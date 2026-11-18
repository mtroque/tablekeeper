# Tablekeeper: Deployment

Web and API as two Vercel projects (Hobby plan), database and sign-in on Neon (Vercel Marketplace). Local development runs offline against local Docker Postgres and test JWTs; production adds hosted Neon, Google OAuth and env vars.

## Order of setup

1. Neon database and Neon Auth (Vercel Marketplace)
2. Google OAuth client
3. Vercel (API)
4. Vercel (web)
5. Wire URLs together, smoke test
6. Migrations and smoke workflows on GitHub

## 1. Neon (Vercel Marketplace)

1. Provision a Neon database with Auth enabled in the same region as the API function (`sin1` for Singapore) and connect it to the `tablekeeper-api` project:
   ```
   vercel integration add neon --name tablekeeper-db --billing-plan free_v3 --meta region=sin1 --meta auth=true --no-env-pull
   ```
   Connecting the resource sets `DATABASE_URL` and `NEON_AUTH_BASE_URL` on `tablekeeper-api`.
2. Apply migrations with the "Migrate production" workflow (see [Migrations](#migrations)).
3. Load rulebooks into production (from your machine, with the reviewed section files):
   ```
   DATABASE_URL=<prod unpooled url> pnpm ingest <gameId> --load
   ```
   Repeat for each game.

## 2. Google OAuth

1. Google Cloud Console → APIs & Services → OAuth consent screen: app name Tablekeeper, support email, scopes `email`, `profile`, `openid`, privacy policy URL `https://<vercel-domain>/privacy` (check it loads once the web app is deployed).
2. **Publishing status: In production.** In "Testing", only listed test users can sign in.
3. Credentials → Create OAuth client ID → Web application.
   - Authorized JavaScript origins: the Vercel URL, `http://localhost:3000`.
   - Authorized redirect URI: `<NEON_AUTH_BASE_URL>/callback/google` (no trailing slash before `/callback/google`).
4. Neon Console → Auth → Providers → Google: paste client ID and secret.
5. Neon Console → Auth → Trusted Origins: add the Vercel URL and `http://localhost:3000`.

## 3. Vercel (API)

The API is its own Vercel project. Its build writes the [Build Output API](https://vercel.com/docs/build-output-api) layout itself: one Node function holding the Express app with every dependency bundled (`apps/api/scripts/build-vercel.mjs`), and a route sending every path to it. Vercel's zero-config Express detection isn't used (D-072).

1. Add New → Project → import the same repo again; name it e.g. `tablekeeper-api`.
2. Settings:
   - Framework Preset: Other
   - Root directory: `apps/api`, with "Include files outside the root directory" on (the default; the build needs `packages/core`)
   - Install command: the default (Vercel installs the pnpm workspace from the repo root)
   - Build command: `pnpm build:vercel`
   - Output directory: leave empty (the build writes `.vercel/output`, which Vercel deploys as is)
   - Functions → Fluid compute: on (the default for new projects). Function region: the one matching the Neon database (`sin1` for Singapore)
3. Environment variables (Production): `DATABASE_URL` and `NEON_AUTH_BASE_URL` (set by the Neon Marketplace integration), plus every other variable under "API" in `.env.example`, `WEB_ORIGINS` = the web project's URL(s), `NODE_ENV=production` and a real `IP_HASH_SALT`. Leave `RATE_LIMIT_STORE` unset: production counts the burst limit in Neon (`database`), shared by every instance. Also `ENABLE_EXPERIMENTAL_COREPACK=1`. Nothing under "Local only", and never `AUTH_TEST_SECRET`.
4. Deploy, then check `GET https://<api-domain>/health` returns `{ ok: true }`.

Limits on Hobby: 300s per request (a rules question stops at 30s, and the function's `maxDuration` is 60s), 4.5MB request and response bodies (the API takes 1MB of JSON at most). Hobby is for non-commercial use only; a paid plan is needed if Tablekeeper ever charges or shows ads.

## 4. Vercel (web)

1. Import the repo; Framework: Next.js; Root directory: `apps/web`. "Include files outside the root directory" is on by default (Project Settings → Build and Deployment); the app needs `packages/core` and `packages/cv`.
2. Install command: the default. Vercel detects the pnpm workspace and installs from the repo root.
3. Build command: the default (`next build`, Turbopack); no override. `pnpm test:build` runs the same build locally and starts the CV worker in it.
4. Environment variables: every variable under "Web" in `.env.example`: `NEXT_PUBLIC_NEON_AUTH_URL` (= `NEON_AUTH_BASE_URL`), `NEXT_PUBLIC_API_URL` = the API project's URL, `NEXT_PUBLIC_ENABLE_EXAMPLE_GAME=false`, `NEXT_PUBLIC_ENABLE_PHOTO_SCORING=true` (D-055). Nothing under "Local only". Also `ENABLE_EXPERIMENTAL_COREPACK=1`, so Vercel uses the pnpm version pinned in `package.json` (`packageManager`), which wrote the lockfile.
5. Deploy; copy the production URL back into Neon Auth Trusted Origins, Google (origins) and the API project (`WEB_ORIGINS`), then redeploy the API if needed.

## 5. Anthropic

- Create an API key for production only.
- Console → Limits: set a monthly spend limit.
- Start with the quota defaults in `.env.example` and raise them later.

## 6. GitHub: production environment and smoke

One-time setup, by the owner (agents never touch production; `AGENTS.md` → Hard rules):

1. Create the `production` environment with the owner as required reviewer, deployable from protected branches only:
   ```
   gh api -X PUT repos/mtroque/tablekeeper/environments/production --input - <<'EOF'
   {"reviewers":[{"type":"User","id":181335750}],"deployment_branch_policy":{"protected_branches":true,"custom_branch_policies":false}}
   EOF
   ```
2. Add the unpooled production database URL (Neon Console → Connect, pooling off) as an environment secret:
   ```
   gh secret set DATABASE_URL_PRODUCTION --env production
   ```
3. Optional: if a production URL changes, set repo variables `SMOKE_API_URL` and `SMOKE_WEB_URL` (`gh variable set SMOKE_API_URL --body https://...`). Without them, `smoke.yml` uses `https://tablekeeper-api.vercel.app` and `https://tablekeeper-beryl.vercel.app`.

## Migrations

Production migrations run only through [`.github/workflows/migrate.yml`](../.github/workflows/migrate.yml) ("Migrate production"), never from a machine:

1. Merge the migration to `main` (tested locally with `pnpm db:reset && pnpm db:types`).
2. Start it: Actions → Migrate production → Run workflow on `main`, or `gh workflow run migrate.yml --ref main`.
3. The job waits in the `production` environment until the owner approves it (Actions → the run → Review deployments).
4. Approved, it runs `node scripts/db.mjs migrate` with `DATABASE_URL_PRODUCTION` and prints each migration it applied (`Applied <file>`), then `Applied <n> of <total> migrations.`, or `No pending migrations (<total> applied).`

Migrations are forward-only, so apply them before (or with) the deploy that needs them, and keep each one safe for the code already running.

## Smoke test after each deploy

**Automatic:** [`.github/workflows/smoke.yml`](../.github/workflows/smoke.yml) runs `pnpm smoke` against production when Vercel reports a successful deploy of a commit on `main` (a `status` event from "Vercel – tablekeeper" or "Vercel – tablekeeper-api"; Vercel reports this repo's deploys as commit statuses, not GitHub Deployments). It checks, read-only and signed out:

- `web`: the home page answers 200 with HTML
- `health`: `GET /health` returns `{ ok: true }`
- `games`: `GET /v1/games` lists the games
- `me-unauthenticated`: `GET /v1/me` without a token is 401 `UNAUTHENTICATED`, not 500
- `cors`: a preflight from the web origin is allowed, with the `authorization` header

A failure opens an issue "Production smoke failed" labeled `needs-human` with the failing checks (or comments on the open one). Run it by hand from Actions → Smoke → Run workflow (optional `api_url` and `web_url`), or locally with `pnpm smoke --api <url> --web <url>`. It doesn't sign in (no automated production account), so after any change to sign-in, saving or history, the owner still checks those by hand below.

**By hand,** after a change the smoke doesn't cover:

- [ ] Home loads on a phone and on desktop (QR side note visible)
- [ ] No "Waking up the server." line on load; the home page shows no status line while online
- [ ] Rules: ask a question for each game, citations open the official PDF
- [ ] "Try Sample Photo" works for each photo game
- [ ] Sign in with Google, save a score, see it in history
- [ ] Sign out; guest flows still work

## Local development after deploying

Nothing changes: `pnpm db:start && pnpm dev` uses `.env.local` and fills local Postgres and test-auth defaults when unset. Hosted environments (both Vercel projects) always set `DATABASE_URL`, `NEON_AUTH_BASE_URL` and `NEXT_PUBLIC_NEON_AUTH_URL` explicitly; local defaults only fill values that are missing. Production secrets never go in `.env.local`. New migrations: add under `db/migrations/`, test locally with `pnpm db:reset && pnpm db:types`, then apply them to production with the "Migrate production" workflow ([Migrations](#migrations)) before (or with) the deploy that needs them.

## Rollback

- Web or API: in that Vercel project, Deployments → the previous good deployment → Promote to Production (Instant Rollback).
- Database: migrations are forward-only; write a new migration to undo a change.
- Emergency: set `LLM_ENABLED=false` in the API project's environment variables and redeploy it to stop all LLM spend.
