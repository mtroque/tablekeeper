# Tablekeeper: Deployment

Web and API as two Vercel projects (Hobby plan), database and auth on Supabase cloud. Local development is unchanged; production only adds hosted copies and env vars.

## Order of setup

1. Supabase cloud project
2. Google OAuth client
3. Vercel (API)
4. Vercel (web)
5. Wire URLs together, smoke test

## 1. Supabase cloud

1. Create a project (region close to users, e.g. Singapore).
2. Link and push migrations from your machine:
   ```
   supabase login
   supabase link --project-ref <ref>
   supabase db push
   ```
3. Load rulebooks into production (from your machine, with the reviewed section files):
   ```
   SUPABASE_URL=<prod url> SUPABASE_SERVICE_ROLE_KEY=<prod key> pnpm ingest <gameId> --load
   ```
   Repeat for each game.
4. Note: project URL, anon key, service role key, JWT settings (Project Settings → API).
5. Auth → URL configuration: Site URL = the Vercel production URL; add redirect URLs for `https://<vercel-domain>/auth/callback` and `http://localhost:3000/auth/callback`.

## 2. Google OAuth

1. Google Cloud Console → APIs & Services → OAuth consent screen: app name Tablekeeper, support email, scopes `email`, `profile`, `openid`, privacy policy URL `https://<vercel-domain>/privacy` (check it loads once the web app is deployed).
2. **Publishing status: In production.** In "Testing", only listed test users can sign in.
3. Credentials → Create OAuth client ID → Web application.
   - Authorized JavaScript origins: the Vercel URL, `http://localhost:3000`.
   - Authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback` (and `http://127.0.0.1:54321/auth/v1/callback` for local).
4. Supabase → Auth → Providers → Google: paste client ID and secret.
5. Local: put the same client ID/secret in `.env.local` (`SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID`, `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET`).

## 3. Vercel (API)

The API is its own Vercel project. Its build writes the [Build Output API](https://vercel.com/docs/build-output-api) layout itself: one Node function holding the Express app with every dependency bundled (`apps/api/scripts/build-vercel.mjs`), and a route sending every path to it. Vercel's zero-config Express detection isn't used (D-072).

1. Add New → Project → import the same repo again; name it e.g. `tablekeeper-api`.
2. Settings:
   - Framework Preset: Other
   - Root directory: `apps/api`, with "Include files outside the root directory" on (the default; the build needs `packages/core`)
   - Install command: the default (Vercel installs the pnpm workspace from the repo root)
   - Build command: `pnpm build:vercel`
   - Output directory: leave empty (the build writes `.vercel/output`, which Vercel deploys as is)
   - Functions → Fluid compute: on (the default for new projects). Function region: the one closest to the Supabase project (e.g. `sin1` for Singapore)
3. Environment variables (Production): every variable under "API" in `.env.example`, with production values, including the commented-out `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` (the cloud project's), `WEB_ORIGINS` = the web project's URL(s), `NODE_ENV=production` and a real `IP_HASH_SALT`. Leave `RATE_LIMIT_STORE` unset: production counts the burst limit in Supabase (`database`), shared by every instance. Also `ENABLE_EXPERIMENTAL_COREPACK=1`. Nothing under "Local only".
4. Deploy, then check `GET https://<api-domain>/health` returns `{ ok: true }`.

Limits on Hobby: 300s per request (a rules question stops at 30s, and the function's `maxDuration` is 60s), 4.5MB request and response bodies (the API takes 1MB of JSON at most). Hobby is for non-commercial use only; a paid plan is needed if Tablekeeper ever charges or shows ads.

## 4. Vercel (web)

1. Import the repo; Framework: Next.js; Root directory: `apps/web`. "Include files outside the root directory" is on by default (Project Settings → Build and Deployment); the app needs `packages/core` and `packages/cv`.
2. Install command: the default. Vercel detects the pnpm workspace and installs from the repo root.
3. Build command: the default (`next build`, Turbopack); no override. `pnpm test:build` runs the same build locally and starts the CV worker in it.
4. Environment variables: every variable under "Web" in `.env.example`: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (the cloud project's), `NEXT_PUBLIC_API_URL` = the API project's URL, `NEXT_PUBLIC_ENABLE_EXAMPLE_GAME=false`, `NEXT_PUBLIC_ENABLE_PHOTO_SCORING=true` (D-055). Nothing under "Local only". Also `ENABLE_EXPERIMENTAL_COREPACK=1`, so Vercel uses the pnpm version pinned in `package.json` (`packageManager`), which wrote the lockfile.
5. Deploy; copy the production URL back into Supabase (Site URL, redirects), Google (origins) and the API project (`WEB_ORIGINS`), then redeploy the API.

## 5. Anthropic

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

Nothing changes: `pnpm db:start && pnpm dev` uses `.env.local` and detects the local Supabase keys. Hosted environments (both Vercel projects) always set the Supabase variables explicitly; detection only fills values that are missing. Production secrets never go in `.env.local`. New migrations: create locally, test, then `supabase db push` before (or with) the deploy that needs them.

## Rollback

- Web or API: in that Vercel project, Deployments → the previous good deployment → Promote to Production (Instant Rollback).
- Database: migrations are forward-only; write a new migration to undo a change.
- Emergency: set `LLM_ENABLED=false` in the API project's environment variables and redeploy it to stop all LLM spend.

## Cutover from Render

One time, for a deployment that still runs the API on Render. Players see no downtime: Render keeps serving until the web app points elsewhere.

1. `supabase db push` (adds `rate_limit_hits` and its functions).
2. Create the API project (section 3) with the same values as the Render service's environment, plus `ENABLE_EXPERIMENTAL_COREPACK=1`. Deploy and check `/health`.
3. In the API project, set `WEB_ORIGINS` to the web URL(s) if it isn't already; redeploy.
4. In the web project, set `NEXT_PUBLIC_API_URL` to the API project's URL and redeploy (the value is built into the page).
5. Run the smoke test above.
6. Delete the external pinger (cron-job.org or UptimeRobot), then delete the Render service.
