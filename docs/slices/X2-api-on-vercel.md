# X2: API on Vercel

**Status:** 🟨 · **Depends on:** S0, S3, S5

**Goal:** Run the existing Express API as its own Vercel project on the Hobby plan instead of Render, so players never wait up to a minute for a sleeping server, and the keep-alive setup goes away.

## Owns
- `apps/api/src/server.ts`, a new Vercel entry next to it (`apps/api/src/vercel.ts`), `apps/api/package.json`, `apps/api/tsup.config.ts`, `apps/api/vercel.json` (if needed), `apps/api/scripts/` (Vercel build script and its smoke check)
- `apps/api/src/middleware/rate-limit.ts` and its tests; a new store for it under `apps/api/src/db/`
- A new migration for the burst limit store, and the regenerated `apps/api/src/db/database.types.ts`
- `apps/web/src/components/server-status.tsx` and its tests
- `apps/web/src/app/privacy/page.tsx` (Services list)
- `docs/DEPLOYMENT.md`, `.env.example`, `README.md`, the hosting lines in `docs/ARCHITECTURE.md`, `docs/UX.md` → Screen states (API waking up row, server status line), `docs/PRODUCT.md` → Privacy page (Services row)
- `tests/e2e/X2.spec.ts`

## Scope
The API stays an Express app (D-005 keeps its boundary; only the host changes).

- **Entry point and build.** Not Vercel's zero-config Express detection: it looks for `src/app.ts` before `src/server.ts` (our `app.ts` has no default export), and its docs don't say whether workspace packages that ship TypeScript source (D-019) get compiled. Instead the API's own build writes the [Build Output API](https://vercel.com/docs/build-output-api) directly: `pnpm --filter @tablekeeper/api build:vercel` bundles `src/vercel.ts` (default export `createApp(loadConfig())`) with every dependency into one CommonJS file under `apps/api/.vercel/output/functions/index.func/`, plus a `.vc-config.json` (Node 22, Nodejs launcher) and a `config.json` routing every path to that function. `server.ts` stays as is for `pnpm dev`, Playwright and `pnpm start`. A check script loads the built function in plain Node and calls `/health`.
- **Burst limit across instances.** A `rate_limit_hits` table (key, hits, reset time) and one `rate_limit_hit(key, window_ms)` SQL function that counts a hit and starts a new fixed window atomically, service role only. A `SupabaseRateLimitStore` adapter implements `express-rate-limit`'s `Store`. Keys are the salted IP hash (D-036's salt), never the raw IP, matching the privacy page. Expired rows are cleaned up now and then by the same function. `RATE_LIMIT_STORE` = `database` | `memory`, default `database` in production and `memory` elsewhere, so local dev and e2e behave exactly as before.
- **Client IP.** Vercel overwrites `x-forwarded-for` with the client's IP (no spoofed hops), so `trust proxy` 1 (already set) gives `req.ip` = the client. Tests cover the burst key and the guest quota subject both using the forwarded IP.
- **Time limit.** Vercel Hobby with Fluid compute allows 300s per function. A rules question is capped at `RULES_TIMEOUT_MS` (30s) by the gateway, whatever the tool calls. Measure the slowest question with `pnpm rules:smoke` and record it here.
- **Server status line.** Nothing to wake, so the waking line, its 2500ms timer and the `/health` call on load all go (D-056 superseded). "You're offline." stays.
- **Docs.** `docs/DEPLOYMENT.md` section 3 rewritten for Vercel, Keep-alive removed, Rollback and kill switch updated, a Cutover step list. Render removed everywhere it is named, including the privacy page's Services list and "Last updated" date.

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
Integration test for the shared burst store (two app instances, one count; separate IPs, separate counts); forwarded-IP tests for the burst key and the guest quota; unit test for the status line without the waking state; a check that the built Vercel function answers `/health`; `tests/e2e/X2.spec.ts` covers the home page with the server status line silent.

## Out of scope
- Merging the API into Next.js route handlers.
- Moving off Supabase or changing auth.
- A paid Vercel plan. Hobby is non-commercial only; revisit if Tablekeeper ever charges or shows ads.

## Open questions
Resolved:
- Shared store: a Supabase table. No new service or dependency; one extra RPC per `/v1` request.
- Same origin: keep two origins (two Vercel projects, CORS as now).
- `/health` on load: no longer needed; dropped. `/health` stays on the API for the deploy smoke test.

## Decisions

## Shared change requests
Applied on `main` as this slice runs (commits marked "requested by X2"):
- `apps/api/src/app.ts`: pass config and clients to `burstLimit` so it can pick its store (changes an existing line).
- `apps/api/src/config.ts` and `config.test.ts`: `RATE_LIMIT_STORE`; the PORT test no longer names Render.
- `apps/web/src/lib/api-client.ts`: the retry comment no longer names Render.
- `tests/e2e/S5.spec.ts`: drop the waking-line test, which X2 makes obsolete.
