# W10: Screen map and screenshots

**Status:** ⬜ · **Depends on:** W7

**Goal:** A typed map of every screen and state (route, state, how to reach it) that agents and humans share, and a CI job that screenshots each at phone size and attaches the images to the PR. Review becomes looking at screens, not reading JSX.

## Owns
- `tests/e2e/screens.ts` (the map), `tests/e2e/screens.spec.ts`, `.github/workflows/ci.yml` (artifact upload and PR comment), `docs/UX.md` (point Routes and Screen states at the map), `docs/AUTOMATION.md` (W10 row)

## Scope (must cover)
- Every route in `docs/UX.md` → Routes with the states in `docs/UX.md` → Screen states that apply (loading, empty, error, guest, offline), plus game-specific states listed in game modules.
- Each entry knows how to reach its state (seeded user, mocked API response, offline mode).
- A check fails if a route exists in `apps/web/src/app` without a map entry.
- Screenshots at 390×844, uploaded as an artifact, linked or embedded in a PR comment.
- Visual diffs only for a few stable screens, if at all (decide and record; fonts and images make them flaky).

## Acceptance criteria
- [ ] Every route has map entries; adding a route without one fails
- [ ] A PR shows its screenshots without anyone running anything locally

## Out of scope

## Open questions

## Decisions

## Shared change requests
