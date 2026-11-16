# W10: Screen map and screenshots

**Status:** ⬜ · **Depends on:** W7, W15

**Goal:** A typed map of every screen and state (route, state, how to reach it) that agents and humans share, and a CI job that screenshots each one at phone size and shows the images in the PR. Review becomes looking at screens, not reading JSX. It builds on W15's `pnpm shot`, which agents already use locally.

## Owns
- `tests/e2e/screens.ts` (the map), `tests/e2e/screens.spec.ts`, `scripts/lib/check-repo/screens.ts` with tests (the route coverage check)
- `scripts/shot.ts` (accepting map entry ids, after W15), `.github/workflows/screens.yml`
- `docs/UX.md` (Routes and Screen states point at the map), `docs/AUTOMATION.md` (W10 row), `README.md` (Commands)

## Scope
- **Map entries:** `{ id, route, state, reach }`. `state` is one of the shared states in `docs/UX.md` → Screen states (default, loading, empty, error, guest, offline) or a named game-specific one; `reach` is a function that sets the page up before the shot. Ways to reach a state, all from existing test tooling:
  - signed in: X4's minted test JWT (`tests/e2e/helpers.ts`); guest is the default
  - data: created through the API helpers with the `screens` prefix and cleaned up after
  - loading and error: `page.route` delaying or failing the relevant API call
  - offline: `context.setOffline(true)`
- **Coverage:** every route in `docs/UX.md` → Routes, each with the shared states that apply to it (a route lists the ones that don't, with a reason, e.g. `/privacy` has no data states), plus the app shell states (header loading, account sheet, callback success and failure, not-found). Game modules list their own states in their entry.
- **Route check:** `pnpm check:repo` walks `apps/web/src/app/**/page.tsx` (excluding `dev/`) and fails when a route has no map entry, naming the route and the map file.
- **`screens.spec.ts`:** one Playwright test per entry at 390×844 in light mode (dark for a few entries marked `dark: true`), writing `test-results/screens/<id>.png`.
- **CI (`screens.yml`):** on PRs that touch `apps/web/`, `packages/core/src/games/` or the map; same environment as W7's `E2E` job. It runs the spec, pushes the PNGs to the orphan branch `screens` under `pr-<number>/<sha>/`, and updates one PR comment with the changed screens embedded (links to the full set). Images on a public repo's branch display without sign-in, unlike artifacts. A cleanup step removes a PR's folder when it closes.
- **Visual diffs:** not now. Fonts, photos and timing make them flaky; the comment shows the screens and a person or W13 judges them. Revisit if a stable subset emerges.

## UI states
None new; this slice photographs the existing ones.

## Acceptance criteria
- [ ] Every route has map entries; adding a `page.tsx` without one fails `pnpm check:repo`
- [ ] A PR touching a screen gets a comment showing its screenshots, with nothing run locally (link the PR)
- [ ] `pnpm shot <entry id>` reproduces a map entry locally

## Tests
- Route check: a route with an entry passes, a new route without one fails, `dev/` is ignored.

## Out of scope
- Visual regression diffs. Accessibility audits (could join later as a step over the same map).

## Open questions

## Decisions
- Screenshots go to an orphan `screens` branch, not artifacts, so the PR comment can embed them.

## Corrections

## Shared change requests
