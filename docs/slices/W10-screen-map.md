# W10: Screen map and screenshots

**Status:** ⏸ (built and tested; waiting on the owner: move `.github/workflow-drafts/screens.yml` to `.github/workflows/screens.yml` and delete its two-line header (the factory's App token can't push workflows), then check that the PR gets the Screens comment, tick that criterion with the PR link and fold the spec) · **Depends on:** W7, W15

**Goal:** A typed map of every screen and state (route, state, how to reach it) that agents and humans share, and a CI job that screenshots each one at phone size and shows the images in the PR. Review becomes looking at screens, not reading JSX. It builds on W15's `pnpm shot`, which agents already use locally.

## Owns
- `tests/e2e/screens.ts` (the map), `tests/e2e/screens.spec.ts`, `scripts/lib/check-repo/screens.ts` with tests `scripts/lib/check-repo/screens.test.ts` (the route coverage check), wired in `scripts/check-repo.ts` and `scripts/lib/check-repo/index.ts`
- `scripts/shot.ts`, `scripts/lib/shot-args.ts`, `scripts/lib/shot-args.test.ts` (accepting map entry ids, after W15)
- `.github/workflows/screens.yml` (staged as `.github/workflow-drafts/screens.yml` until the owner moves it), `scripts/screens-report.ts`, `scripts/lib/screens-report.ts`, `scripts/lib/screens-report.test.ts` (the PR comment)
- `playwright.config.ts` (additive: the `SCREENS` env flag)
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
- [x] Every route has map entries; adding a `page.tsx` without one fails `pnpm check:repo` (60 entries over 14 UX routes, the app shell and not-found; `screens.test.ts`; a scratch `apps/web/src/app/stats/page.tsx` made `pnpm check:repo` exit 1 naming the route and `tests/e2e/screens.ts`; all 61 entries reached their state in `SCREENS=1 pnpm test:e2e screens` once `result-offline` was fixed)
- [ ] A PR touching a screen gets a comment showing its screenshots, with nothing run locally (link the PR)
- [x] `pnpm shot <entry id>` reproduces a map entry locally (`pnpm shot result-offline` wrote `.scratch/<branch>/shots/result-offline.png`, checked by eye; `parseShotRequest` tests)

## Tests
- Route check: a route with an entry passes, a new route without one fails, `dev/` is ignored.

## Out of scope
- Visual regression diffs. Accessibility audits (could join later as a step over the same map).

## Open questions
None left. Resolved from the docs:
- **Map shape:** entries are `{ id, screen, route, state, reach, dark? }`: `screen` names a row of `docs/UX.md` → Routes (or `app shell`, `not found`), `route` is the concrete URL. Several UX routes share one `page.tsx` (`/score/[[...slug]]`), so a concrete URL alone can't say which screen it shows. `SCREEN_ROUTES` lists each screen with its `page.tsx` and a reason for every shared state it skips.
- **Which screens changed:** each PNG's hash is compared with the `main/` set on the `screens` branch, refreshed by the same workflow on pushes to `main`. With no baseline yet every screen counts as changed.
- **Normal e2e runs:** `screens.spec.ts` runs only with `SCREENS=1` (`playwright.config.ts`), so the required `E2E` job doesn't double in length.

## Decisions
- Screenshots go to an orphan `screens` branch, not artifacts, so the PR comment can embed them.
- **Map shape:** entries name a `screen` (a `docs/UX.md` → Routes row, `app shell` or `not found`) as well as a concrete `route`, since the score flow's screens share one `page.tsx`. `SCREEN_ROUTES` gives every screen a reason for each shared state it lacks; `check:repo` checks `page.tsx` files, UX routes, duplicate ids and state coverage.
- **Changed screens:** PNG hashes against the `main/` set on the `screens` branch, refreshed on pushes to `main`; shots disable animations so unchanged screens hash the same. Only a PR's latest run is kept on the branch.
- **Loading of server-rendered states** (header, callback): the shot holds the app's JavaScript, so it shows the server render before hydration.
- **Separate from E2E:** `screens.spec.ts` runs only with `SCREENS=1`; additive line in `playwright.config.ts` (`testIgnore`). Wiring: `checkScreenMap` export in `scripts/lib/check-repo/index.ts` and its call in `scripts/check-repo.ts`.
- **Workflow as a draft:** the push of `.github/workflows/screens.yml` was refused ("refusing to allow a GitHub App to create or update workflow ... without `workflows` permission"), as for W26; it waits in `.github/workflow-drafts/`. No other credential was tried.
- **Found while mapping (not fixed here, not owned):** saving a result while offline doesn't show "You're offline." as `docs/UX.md` → Screen states asks: TanStack Query pauses the mutation, so the button stays at "Saving". The `result-offline` entry shoots that behavior. Candidate fix for the score flow (`networkMode: 'always'` on the save mutation, or an offline check before saving).

## Corrections
| Date | Pattern | Where | What was wrong | Correction | Source | Status |
|---|---|---|---|---|---|---|
| 2026-11-18 | `workflow-push-refused` | W10, `screens.yml` | Pushing a new workflow file from the factory was refused for lack of the App's `workflows` permission (second time, after W26) | Staged under `.github/workflow-drafts/` for the owner; candidate check: `check:repo` or the factory warns before a push that touches `.github/workflows/`, or the App gets `workflows` | self | open |
| 2026-11-18 | `ui-state-untested-assumption` | W10, `result-offline` entry | The map assumed the documented offline save message; the app pauses the save instead, so the entry failed | Entry shoots the real behavior; gap noted under Decisions | self | open |

## Shared change requests
