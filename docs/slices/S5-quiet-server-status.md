# S5: Quiet server status

**Status:** ⬜ · **Depends on:** S0

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

## UI states

None beyond `docs/UX.md` → Screen states.

## Acceptance criteria

- [ ] With `/health` blocked (Playwright `route.abort('blockedbyclient')`), no server status line appears and the library renders.
- [ ] A rules question with the API unreachable still shows "Couldn't reach the server. Try again." on that turn.

## Tests

`tests/e2e/S5.spec.ts` covers the blocked `/health` case above.

## Out of scope

- Renaming `/health` or changing the API.
- Detecting "down" from other API calls.

## Open questions

## Decisions

## Shared change requests
