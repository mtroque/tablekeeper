# X2: API on Vercel

**Status:** ⏸ · **Depends on:** S0, S3, S5

**Paused:** deployed and cut over on 9 November 2026. Left: the hand-run smoke test steps in the last criterion, then delete the Render service and the external pinger, then set ✅.

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
- [x] The API deploys to Vercel from the repo with the documented settings, and `GET /health` returns `{ ok: true }` there. Project `tablekeeper-api` (root `apps/api`, `pnpm build:vercel`, Node 24, Fluid compute, `sin1`), deployed from GitHub on push to `main` (commit `6395667`); `https://tablekeeper-api.vercel.app/health` answered `{ ok: true }` in 0.58s on a cold instance. Locally, `apps/api/src/vercel.test.ts` loads the same build in plain Node
- [x] The burst limit is shared across instances: a test with two app instances on one store hits `RATE_LIMITED` at the configured total (`middleware/rate-limit.test.ts`: 3 allowed, the 4th on the other instance is 429; 16 concurrent requests over two instances give exactly 10 × 200 and 6 × 429)
- [x] Per-IP guest quotas use the real client IP behind Vercel's proxy (test with a forwarded header): two forwarded IPs get separate guest quotas and separate burst counts, and the stored burst key is the salted hash of the forwarded IP, never the IP itself
- [x] The slowest rules question finishes within the function limit (measured, numbers recorded here). Four multi-part questions with the real model, on 9 November 2026:

  | Game | Time | Model calls | Tool calls | Result |
  |---|---|---|---|---|
  | Dorfromantik | 7.1s | 3 | 6 | answered, 3 citations |
  | Harmonies | 16.4s | 6 | 7 | answered, 2 citations |
  | Azul | 27.8s | 9 | 13 | notCovered |
  | Patchwork | 8.0s | 3 | 8 | notCovered, 4 citations |

  The gateway stops every question at 30s (`RULES_TIMEOUT_MS`), so a request can't pass about 30s plus a few database calls. The function's `maxDuration` is 60s, under Hobby's 300s.
- [x] The server status line never shows "Waking up the server."; "You're offline." still shows offline (`server-status.test.ts`; `tests/e2e/X2.spec.ts` watches the page for 3s with no status line and no `/health` request, then goes offline and back)
- [x] `pnpm dev`, `pnpm test` and `pnpm test:e2e` run the API locally exactly as before (`server.ts` unchanged; outside production the burst limit stays in memory; `pnpm dev` served `/health` and `/v1/games` with the usual 60 a minute policy; full test and e2e suites pass)
- [x] No doc, env comment or UI text names Render; the privacy page lists the current services ("Vercel hosts the website and the server.", dated 9 November 2026). The only remaining mentions are the one-time Cutover from Render steps in `docs/DEPLOYMENT.md`, which this spec asks for, and past entries in `docs/DECISIONS.md`
- [ ] The deploy smoke test in `docs/DEPLOYMENT.md` passes on the Vercel API. Passed on 9 November 2026: `/health`; requests served from `sin1`; two instances shared one burst window (59, then 58 left); CORS allows only the web origin; one guest question per game answered in 6.9s to 8.7s, each with 2 citations opening the publisher PDF at a page; after the cutover the live site's bundle calls only `tablekeeper-api.vercel.app`, with no status line and no page errors. Still to check by hand: home on a phone and desktop (QR side note), Try Sample Photo per photo game, sign in, save a score and see it in history, sign out

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
- **D-072** The API deploys through the Build Output API: `pnpm build:vercel` bundles `src/vercel.ts` and every dependency into one CommonJS function (`index.cjs` re-exports the app as `module.exports`) and routes every path to it; `maxDuration` 60s. Why: Vercel's zero-config Express detection lists `src/app.ts` before `src/server.ts` (our `app.ts` has no default export), and its docs don't say whether workspace packages that ship TypeScript source are compiled. Building the output ourselves deploys exactly what the test loads. No new dependency (tsup already bundles the API).
- **D-073** The burst limit counts in Postgres (`rate_limit_hits`, `rate_limit_hit` in one statement) through a small `express-rate-limit` store, keyed by `burst:` plus the salted IP hash; `RATE_LIMIT_STORE` defaults to `database` in production and `memory` elsewhere. A store error fails the request (the default), like any other database outage. Why: serverless instances don't share memory; Supabase adds no service or dependency (Upstash would add both), at one extra RPC per `/v1` request; memory outside production keeps dev and e2e unchanged.
- **D-074** The server status line shows only "You're offline."; nothing calls `/health` on load. Supersedes D-056. Why: the API on Vercel never sleeps, so there is nothing to wake or explain; each feature reports its own failed calls (S5).
- Kept two origins (no Next rewrite to the API project); CORS and `NEXT_PUBLIC_API_URL` work as before.
- Wiring and shared edits on `main` (see below): the `burstLimit` call in `apps/api/src/app.ts`, `RATE_LIMIT_STORE` in `config.ts`, `.vercel/` in `.gitignore` and the ESLint ignores.

## Shared change requests
Applied on `main` as this slice runs (commits marked "requested by X2"):
- `apps/api/src/app.ts`: pass config and clients to `burstLimit` so it can pick its store (changes an existing line).
- `apps/api/src/config.ts` and `config.test.ts`: `RATE_LIMIT_STORE`; the PORT test no longer names Render.
- `apps/web/src/lib/api-client.ts`: the retry comment no longer names Render.
- `tests/e2e/S5.spec.ts`: drop the waking-line test, which X2 makes obsolete, and the blocked test's count of `/health` calls (nothing calls it now).
- `.gitignore` and `eslint.config.js`: ignore `.vercel/`, the local build output.
