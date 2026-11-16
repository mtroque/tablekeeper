# Tablekeeper: Deployment

Web and API as two Vercel projects (Hobby plan), database on Neon (Vercel Marketplace), sign-in on Supabase Auth until X4. Local development is unchanged; production only adds hosted copies and env vars.

## Order of setup

1. Neon database (Vercel Marketplace)
2. Supabase cloud project (Auth)
3. Google OAuth client
4. Vercel (API)
5. Vercel (web)
6. Wire URLs together, smoke test

## 1. Neon (Vercel Marketplace)

1. Provision a Neon database in the same region as the API function (`sin1` for Singapore) and connect it to the `tablekeeper-api` project:
   ```
   vercel integration add neon --name tablekeeper-db --billing-plan free_v3 --meta region=sin1 --meta auth=true --no-env-pull
   ```
   Connecting the resource sets `DATABASE_URL` on `tablekeeper-api`.
2. Push migrations from your machine:
   ```
   DATABASE_URL=<prod url> node scripts/db.mjs migrate
   ```
3. Load rulebooks into production (from your machine, with the reviewed section files):
   ```
   DATABASE_URL=<prod url> pnpm ingest <gameId> --load
   ```
   Repeat for each game.

## 2. Supabase cloud (Auth)

1. Create a project for Google sign-in.
2. Note: project URL and anon key (Project Settings → API).
3. Auth → URL configuration: Site URL = the Vercel production URL; add redirect URLs for `https://<vercel-domain>/auth/callback` and `http://localhost:3000/auth/callback`.

## 3. Google OAuth

1. Google Cloud Console → APIs & Services → OAuth consent screen: app name Tablekeeper, support email, scopes `email`, `profile`, `openid`, privacy policy URL `https://<vercel-domain>/privacy` (check it loads once the web app is deployed).
2. **Publishing status: In production.** In "Testing", only listed test users can sign in.
3. Credentials → Create OAuth client ID → Web application.
   - Authorized JavaScript origins: the Vercel URL, `http://localhost:3000`.
   - Authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback` (and `http://127.0.0.1:54321/auth/v1/callback` for local).
4. Supabase → Auth → Providers → Google: paste client ID and secret.
5. Local: put the same client ID/secret in `.env.local` (`SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID`, `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET`).

## 4. Vercel (API)

The API is its own Vercel project. Its build writes the [Build Output API](https://vercel.com/docs/build-output-api) layout itself: one Node function holding the Express app with every dependency bundled (`apps/api/scripts/build-vercel.mjs`), and a route sending every path to it. Vercel's zero-config Express detection isn't used (D-072).

1. Add New → Project → import the same repo again; name it e.g. `tablekeeper-api`.
2. Settings:
   - Framework Preset: Other
   - Root directory: `apps/api`, with "Include files outside the root directory" on (the default; the build needs `packages/core`)
   - Install command: the default (Vercel installs the pnpm workspace from the repo root)
   - Build command: `pnpm build:vercel`
   - Output directory: leave empty (the build writes `.vercel/output`, which Vercel deploys as is)
   - Functions → Fluid compute: on (the default for new projects). Function region: the one matching the Neon database (`sin1` for Singapore)
3. Environment variables (Production): `DATABASE_URL` (set by the Neon Marketplace integration), plus every other variable under "API" in `.env.example`, including `SUPABASE_URL` and `SUPABASE_ANON_KEY` (the cloud Auth project's), `WEB_ORIGINS` = the web project's URL(s), `NODE_ENV=production` and a real `IP_HASH_SALT`. Leave `RATE_LIMIT_STORE` unset: production counts the burst limit in Neon (`database`), shared by every instance. Also `ENABLE_EXPERIMENTAL_COREPACK=1`. Nothing under "Local only".
4. Deploy, then check `GET https://<api-domain>/health` returns `{ ok: true }`.

Limits on Hobby: 300s per request (a rules question stops at 30s, and the function's `maxDuration` is 60s), 4.5MB request and response bodies (the API takes 1MB of JSON at most). Hobby is for non-commercial use only; a paid plan is needed if Tablekeeper ever charges or shows ads.

## 5. Vercel (web)

1. Import the repo; Framework: Next.js; Root directory: `apps/web`. "Include files outside the root directory" is on by default (Project Settings → Build and Deployment); the app needs `packages/core` and `packages/cv`.
2. Install command: the default. Vercel detects the pnpm workspace and installs from the repo root.
3. Build command: the default (`next build`, Turbopack); no override. `pnpm test:build` runs the same build locally and starts the CV worker in it.
4. Environment variables: every variable under "Web" in `.env.example`: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (the cloud project's), `NEXT_PUBLIC_API_URL` = the API project's URL, `NEXT_PUBLIC_ENABLE_EXAMPLE_GAME=false`, `NEXT_PUBLIC_ENABLE_PHOTO_SCORING=true` (D-055). Nothing under "Local only". Also `ENABLE_EXPERIMENTAL_COREPACK=1`, so Vercel uses the pnpm version pinned in `package.json` (`packageManager`), which wrote the lockfile.
5. Deploy; copy the production URL back into Supabase (Site URL, redirects), Google (origins) and the API project (`WEB_ORIGINS`), then redeploy the API.

## 6. Anthropic

- Create an API key for production only.
- Console → Limits: set a monthly spend limit.
- Start with the quota defaults in `.env.example` and raise them later.

## Smoke test after each deploy

- [ ] Home loads on a phone and on desktop (QR side note visible)
- [ ] `GET https://<api-domain>/health` returns `{ ok: true }`
- [ ] No "Waking up the server." line on load; the home page shows no status line while online
- [ ] Rules: ask a question for each game, citations open the official PDF
- [ ] "Try Sample Photo" works for each photo game
- [ ] Sign in with Google, save a score, see it in history
- [ ] Sign out; guest flows still work

## Local development after deploying

Nothing changes: `pnpm db:start && pnpm dev` uses `.env.local` and detects the local database URL and Supabase Auth keys. Hosted environments (both Vercel projects) always set `DATABASE_URL` and the Auth variables explicitly; detection only fills values that are missing. Production secrets never go in `.env.local`. New migrations: add under `db/migrations/`, test locally with `pnpm db:reset && pnpm db:types`, then `DATABASE_URL=<prod url> node scripts/db.mjs migrate` before (or with) the deploy that needs them.

## Rollback

- Web or API: in that Vercel project, Deployments → the previous good deployment → Promote to Production (Instant Rollback).
- Database: migrations are forward-only; write a new migration to undo a change.
- Emergency: set `LLM_ENABLED=false` in the API project's environment variables and redeploy it to stop all LLM spend.

## Cutover from Supabase Postgres to Neon

One time, moving the database from Supabase to Neon while keeping Google sign-in on Supabase Auth until X4. Fresh start: schema and rulebooks are loaded into Neon; old Supabase play history is not copied.

1. Add the Neon Marketplace resource to `tablekeeper-api` in `sin1` (section 1), which sets `DATABASE_URL` on the API project.
2. Run `DATABASE_URL=<neon url> node scripts/db.mjs migrate` to apply `db/migrations/*.sql`.
3. Run `DATABASE_URL=<neon url> pnpm ingest <gameId> --load` for `patchwork`, `azul`, `harmonies` and `dorfromantik`.
4. Deploy `tablekeeper-api` (with the `postgres` driver reading `DATABASE_URL`) and remove `SUPABASE_SERVICE_ROLE_KEY` from `tablekeeper-api`'s environment variables.
5. Run the smoke test above: `/health`, a guest rules question, and a signed-in save.
