# S1: Score flow, sessions and history

**Status:** ⬜ · **Depends on:** S0

**Goal:** the generic "score a game" experience every game plugs into: photo or manual entry → review → breakdown → save → history, for guests and signed-in users.

## Owns
- `packages/core/src/kit/` (not `types.ts`), `packages/core/src/contracts/{sessions,campaigns}.ts`, `packages/core/src/games/_example/`
- `apps/api/src/{routes,services,db}/{sessions,campaigns}.ts`
- `apps/web/src/components/` (score-flow components), `apps/web/src/lib/session-store/`, `apps/web/src/app/games/[gameId]/{score,history,campaign}/**`
- `tests/e2e/S1.spec.ts`

## Scope

**core**
- `kit/square-grid.ts`, `kit/hex-grid.ts`: neighbors, connected components, shortest-path distances (breadth-first search), and a group's diameter: the greatest shortest-path distance between two of its cells, counted in cells (Harmonies river length, `HAR-WATER-A-1`).
- `kit/breakdown.ts` (build and sum categories), `kit/state.ts` (`parseState`: upgrade, then validate).
- `games/_example/`: a 3×3 "count covered cells" game for tests, registered only when `NODE_ENV=test` or `NEXT_PUBLIC_ENABLE_EXAMPLE_GAME=true`.
- Session and campaign contracts.

**api:** the sessions and campaigns routes in ARCHITECTURE → API. Unknown game → `NOT_FOUND`; a game without a scorer → 422; campaign state validated by the game's `campaign.schema`.

**web**
- `LocalStore` and `ApiStore`, chosen by auth state.
- Score flow per `docs/UX.md` (score home, capture, review, result), with its state in `sessionStorage`. Capture calls `detectBoard`; on `unavailable` or an error it says "Photo reading isn't available yet." and offers manual entry. "Try Sample Photo" lists the module's `samples` and is hidden when there are none.
- `/games/[gameId]/score/[[...slug]]` renders the module's `ScoreFlow` (with the slug) when it has one, else the default flow; `/campaign` renders its `Campaign`. Game slices never add routes.
- Guest save → sign-in → saved on return, without re-entry.
- History list (personal best, average) and read-only detail.
- The score-flow components in `docs/UX.md` → Components.
- `detection_meta` = `{ corrected: CellRef[], fieldsChanged: string[] }`, the differences between draft and confirmed state.

## UI states
Review with no low-confidence values (no banner), save failed (retry keeps the result), history pagination loading.

## Acceptance criteria
- [ ] Example game, signed in: manual entry → review → result → save → in history with the right total; the detail page matches.
- [ ] Guest: "Sign In with Google" saves after Google sign-in without re-entry; "Don't Save" stores nothing.
- [ ] Refreshing on review keeps the board.
- [ ] Square and hex editors render from a layout, report taps as `CellRef`s, and work by keyboard.
- [ ] A tampered `score_total` is ignored and the recomputed one stored.

## Out of scope
Real games, CV (S2), rules (S3).
