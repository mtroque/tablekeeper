# Tablekeeper: Deployment

Web on Vercel, API on Render, database and auth on Supabase cloud. Local development is unchanged; production only adds hosted copies and env vars.

## Order of setup

1. Supabase cloud project
2. Google OAuth client
3. Render (API)
4. Vercel (web)
5. Wire URLs together, keep-alive, smoke test

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

1. Google Cloud Console → APIs & Services → OAuth consent screen: app name Tablekeeper, support email, scopes `email`, `profile`, `openid`.
2. **Publishing status: In production.** In "Testing", only listed test users can sign in.
3. Credentials → Create OAuth client ID → Web application.
   - Authorized JavaScript origins: the Vercel URL, `http://localhost:3000`.
   - Authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback` (and `http://127.0.0.1:54321/auth/v1/callback` for local).
4. Supabase → Auth → Providers → Google: paste client ID and secret.
5. Local: put the same client ID/secret in `.env.local` (`SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID`, `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET`).

## 3. Render (API)

1. New → Web Service → connect the GitHub repo.
2. Settings:
   - Root directory: repository root
   - Runtime: Node
   - Build command: `corepack enable && pnpm install --frozen-lockfile && pnpm --filter @tablekeeper/api... build`
   - Start command: `pnpm --filter @tablekeeper/api start`
   - Health check path: `/health`
   - Instance type: Free
3. Environment variables: every variable under "API" in `.env.example`, with production values, including the commented-out `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` (the cloud project's), `WEB_ORIGINS` = the Vercel URL(s) and `NODE_ENV=production`. Nothing under "Local only".
4. The free tier sleeps after 15 minutes without traffic and can take up to a minute to wake; one always-on free service fits the monthly free hours only if it's the workspace's only free service.

### Keep-alive
- External pinger (cron-job.org or UptimeRobot) → `GET https://<render-service>/health` every 10 minutes.
- The web app also calls `/health` on load, so the API starts waking as soon as someone opens the site.
- Known false alarm (suspected, not yet confirmed): an ad or tracker blocker that blocks the `/health` request makes the status line show "Couldn't reach the server. Scoring still works." even though the API is up and other calls succeed. When debugging that message, check the browser's network tab for a blocked `/health` request, or retry with the blocker off, before assuming the API is down. S5 removes this line (`docs/slices/S5-quiet-server-status.md`).

## 4. Vercel (web)

1. Import the repo; Framework: Next.js; Root directory: `apps/web`. "Include files outside the root directory" is on by default (Project Settings → Build and Deployment); the app needs `packages/core` and `packages/cv`.
2. Install command: the default. Vercel detects the pnpm workspace and installs from the repo root.
3. **Build command: `next build --webpack`** (override). The default Turbopack build hangs because the CV worker imports the web game UI registry; until S4 fixes it, the webpack build deploys every page, and photo detection fails in the worker. Details: `docs/slices/S4-cv-worker-detectors.md`. Remove the override when S4 is done.
4. Environment variables: every variable under "Web" in `.env.example`: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (the cloud project's), `NEXT_PUBLIC_API_URL` = the Render URL, `NEXT_PUBLIC_ENABLE_EXAMPLE_GAME=false`. Nothing under "Local only". Also `ENABLE_EXPERIMENTAL_COREPACK=1`, so Vercel uses the pnpm version pinned in `package.json` (`packageManager`), which wrote the lockfile.
5. Deploy; copy the production URL back into Supabase (Site URL, redirects), Google (origins) and Render (`WEB_ORIGINS`), then redeploy the API.

## 5. Anthropic

- Create an API key for production only.
- Console → Limits: set a monthly spend limit.
- Start with the quota defaults in `.env.example` and raise them later.

## Smoke test after each deploy

- [ ] Home loads on a phone and on desktop (QR side note visible)
- [ ] `GET /health` returns `{ ok: true }`
- [ ] Rules: ask a question for each game, citations open the official PDF
- [ ] "Try Sample Photo" works for each photo game
- [ ] Sign in with Google, save a score, see it in history
- [ ] Sign out; guest flows still work

## Local development after deploying

Nothing changes: `pnpm db:start && pnpm dev` uses `.env.local` and detects the local Supabase keys. Hosted environments (Render, Vercel) always set the Supabase variables explicitly; detection only fills values that are missing. Production secrets never go in `.env.local`. New migrations: create locally, test, then `supabase db push` before (or with) the deploy that needs them.

## Rollback

- Vercel and Render: redeploy the previous successful build from their dashboards.
- Database: migrations are forward-only; write a new migration to undo a change.
- Emergency: set `LLM_ENABLED=false` on Render to stop all LLM spend immediately.
