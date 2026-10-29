# S5: Quiet server status

**Status:** ✅ · **Depends on:** S0

**Goal:** Players never see a false "Couldn't reach the server." line. Today an ad or tracker blocker that blocks `GET /health` shows it even though the API is up, which makes a working app look broken.

## Owns

- `apps/web/src/components/server-status.tsx`
- `docs/slices/S0-foundation.md` → UI states (the server status line bullet)
- `docs/DEPLOYMENT.md` → Keep-alive (the false alarm note)
- `tests/e2e/S5.spec.ts`

## Scope

Must cover:

- Remove the `down` state of `ServerStatus`: the "Couldn't reach the server. Scoring still works." line, its Retry button and the `CloudOff` icon.
- Keep the fire-and-forget `GET /health` on load, so the API still starts waking (`docs/DEPLOYMENT.md` → Keep-alive).
- A failed or blocked `/health` simply shows nothing.
- Leave per-call errors alone: features that call the API still show "Couldn't reach the server. Try again." from `lib/api-client.ts` when their own request fails.
- Update the S0 UI states bullet and replace the DEPLOYMENT.md note with a line saying a blocked `/health` is harmless.

The remaining states are unchanged: "Waking up the server." while `/health` is slow, and "You're offline." while the browser is offline.

A blocked `/health` fails at once, but the API client retries a network failure once after 1500ms (`lib/api-client.ts`), so the call settles a little after 1500ms. The waking line must not appear for it: the slow threshold sits safely above that (2500ms), which still shows the line within seconds of a real cold start (up to a minute).

## UI states

None beyond `docs/UX.md` → Screen states.

## Acceptance criteria

- [x] With `/health` blocked (Playwright `route.abort('blockedbyclient')`), no server status line appears (not even briefly) and the library renders. (`tests/e2e/S5.spec.ts`: a MutationObserver records any `status-*` element from page load through 3s after both blocked calls; the same test fails against the old component.)
- [x] With `/health` held open, "Waking up the server." still appears. (`tests/e2e/S5.spec.ts`)
- [x] A rules question with the API unreachable still shows "Couldn't reach the server. Try again." on that turn. (`tests/e2e/S5.spec.ts`, every API call refused)

## Tests

`tests/e2e/S5.spec.ts` covers the blocked `/health` case, the waking line while `/health` hangs, and a rules question with the API unreachable.

## Out of scope

- Renaming `/health` or changing the API.
- Detecting "down" from other API calls.

## Open questions

## Decisions

- A failed `/health` hides the status line rather than showing any message: the page can't tell an ad blocker from a down API, and each feature already reports its own failed calls.
- `SLOW_AFTER_MS` goes from 1500 to 2500. With the API client's single retry after 1500ms, a blocked `/health` settles just after 1500ms and would otherwise race the slow timer and flash "Waking up the server.". A real Render cold start takes far longer, so the waking line still shows.

## Shared change requests

- `README.md`, the "Live:" note: drop the sentence "An ad blocker may make the app say "Couldn't reach the server." by blocking its health check; everything still works." S5 removes that message, so the note is stale once merged.
