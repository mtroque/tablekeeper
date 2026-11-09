# X2: API on Vercel

**Status:** ⬜ · **Depends on:** S0, S3, S5

**Goal:** Run the existing Express API as its own Vercel project on the Hobby plan instead of Render, so players never wait up to a minute for a sleeping server, and the keep-alive setup goes away.

## Owns
- `apps/api/src/server.ts`, a new Vercel entry next to it if one is needed, `apps/api/package.json`, `apps/api/tsup.config.ts`, `apps/api/vercel.json` (if needed)
- `apps/api/src/middleware/rate-limit.ts` and its tests; a new store for it under `apps/api/src/db/`
- A new migration for the burst limit store (if the store lives in Supabase)
- `apps/web/src/components/server-status.tsx` and its tests
- `apps/web/src/app/privacy/page.tsx` (Services list)
- `docs/DEPLOYMENT.md`, `.env.example`, `README.md`, the hosting lines in `docs/ARCHITECTURE.md`, `docs/UX.md` → Screen states (API waking up row, server status line), `docs/PRODUCT.md` → Privacy page (Services row)
- `tests/e2e/X2.spec.ts`

## Scope
The API stays an Express app (D-005 keeps its boundary; only the host changes). Must cover:

- **Entry point.** Vercel's zero-config Express support deploys `src/server.ts` as one function with Fluid compute. Check that it handles `app.listen` and the signal handlers; if not, add an entry that exports `createApp(loadConfig())` and keep `server.ts` for local dev and Playwright.
- **Build.** The workspace packages ship TypeScript source (D-019). Confirm Vercel bundles `packages/core` into the function, either from source or through the existing tsup build.
- **Burst limit across instances.** `express-rate-limit` counts in memory, so each serverless instance would keep its own count. Give it a shared store (Supabase table plus a small store adapter, or Upstash) so the D-007 limit holds on Vercel. Tests cover two app instances sharing one count.
- **Client IP.** `trust proxy` and the salted IP hash (D-036) must read Vercel's forwarded header correctly; per-IP quotas must not collapse to one IP.
- **Time limit.** Measure the slowest rules question (6 tool calls) against Vercel Hobby's 300s function limit and the gateway's own `timeoutMs`.
- **Server status line.** No cold start to explain: drop "Waking up the server." and its 2500ms timer (D-056), keep "You're offline.". Decide whether the `/health` call on load is still needed.
- **Docs.** Rewrite `docs/DEPLOYMENT.md` section 3 for Vercel (second project, root `apps/api`, env vars, Fluid compute on), remove Keep-alive, update Rollback and the kill switch line. Replace Render everywhere it is named, including the privacy page's Services list and its "Last updated" date.
- **Cutover.** A step list in `docs/DEPLOYMENT.md`: deploy the API project, point `NEXT_PUBLIC_API_URL` and `WEB_ORIGINS` at it, smoke test, then delete the Render service and the external pinger.

## UI states
None new. The waking state is removed from `docs/UX.md` → Screen states.

## Acceptance criteria
- [ ] The API deploys to Vercel from the repo with the documented settings, and `GET /health` returns `{ ok: true }` there
- [ ] The burst limit is shared across instances: a test with two app instances on one store hits `RATE_LIMITED` at the configured total
- [ ] Per-IP guest quotas use the real client IP behind Vercel's proxy (test with a forwarded header)
- [ ] The slowest rules question finishes within the function limit (measured, numbers recorded here)
- [ ] The server status line never shows "Waking up the server."; "You're offline." still shows offline
- [ ] `pnpm dev`, `pnpm test` and `pnpm test:e2e` run the API locally exactly as before
- [ ] No doc, env comment or UI text names Render; the privacy page lists the current services
- [ ] The deploy smoke test in `docs/DEPLOYMENT.md` passes on the Vercel API

## Tests
Integration test for the shared burst store; unit test for the status line without the waking state; `tests/e2e/X2.spec.ts` covers the home page with the server status line silent.

## Out of scope
- Merging the API into Next.js route handlers.
- Moving off Supabase or changing auth.
- A paid Vercel plan. Hobby is non-commercial only; revisit if Tablekeeper ever charges or shows ads.

## Open questions
- Shared store for the burst limit: a Supabase table (no new service, one extra query per request) or Upstash Redis (new service and dependency, faster)? Leaning Supabase.
- Same origin: add a Next rewrite from `/api/*` to the API project so the browser makes same-origin calls (no CORS, no `NEXT_PUBLIC_API_URL` in production), or keep two origins? Leaning keep two origins for this slice.
- Does the web app still need `/health` on load once nothing has to be woken?

## Decisions

## Shared change requests
