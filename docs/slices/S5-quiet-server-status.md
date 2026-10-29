# S5: Quiet server status

**Status:** 🟨 · **Depends on:** S0

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

- [ ] With `/health` blocked (Playwright `route.abort('blockedbyclient')`), no server status line appears (not even briefly) and the library renders.
- [ ] With `/health` held open, "Waking up the server." still appears.
- [ ] A rules question with the API unreachable still shows "Couldn't reach the server. Try again." on that turn.

## Tests

`tests/e2e/S5.spec.ts` covers the blocked `/health` case, the waking line while `/health` hangs, and a rules question with the API unreachable.

## Out of scope

- Renaming `/health` or changing the API.
- Detecting "down" from other API calls.

## Open questions

## Decisions

## Shared change requests
