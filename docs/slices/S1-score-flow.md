# S1: Score flow, sessions and history

**Status:** 🟨 · **Depends on:** S0

**Goal:** the generic "score a game" experience every game plugs into: photo or manual entry → review → breakdown → save → history, for guests and signed-in users.

## Owns
- `packages/core/src/kit/` (not `types.ts`), `packages/core/src/contracts/{sessions,campaigns}.ts`, `packages/core/src/games/_example/`
- `apps/api/src/{routes,services,db}/{sessions,campaigns}.ts` (and their tests)
- `apps/web/src/components/` (score-flow components), `apps/web/src/lib/session-store/`, `apps/web/src/app/games/[gameId]/{score,history,campaign}/**`
- `apps/web/src/games/_example/` (the example game's `GameUiModule`; a new folder no other slice touches)
- `tests/e2e/S1.spec.ts`

## Scope

**core**
- `kit/square-grid.ts`, `kit/hex-grid.ts`: neighbors, connected components, shortest-path distances (breadth-first search), and a group's diameter: the greatest shortest-path distance between two of its cells, counted in cells (Harmonies river length, `HAR-WATER-A-1`). Hex cells use the axial coordinates and neighbor order in `docs/games/harmonies.md` → Coordinates; keys are `"row,col"` (square) and `"q,r"` (hex), matching `ConfidenceMap` keys.
- Layout types for the editors: `SquareLayout` (`rows`, `cols`, optional `skip` keys) and `HexLayout` (list of `{ q, r }`, flat-topped), with `cellKey` / `cellRefKey` helpers.
- `kit/breakdown.ts` (`category()`, `buildBreakdown()` summing categories into `total`), `kit/state.ts` (`parseState(game, raw, fromVersion)`: upgrade when `fromVersion < stateVersion`, then validate; returns `Result`). `kit/define.ts`: `defineGame<State>()` erases the state type so typed games fit the registry.
- `games/_example/`: a 3×3 "count covered cells" game for tests. State `{ cells: boolean[] }` (9 entries, row-major); one point per covered cell; no rules, no rulebook (`features.rules` false), scorer only. Registered only when `NODE_ENV=test` or `NEXT_PUBLIC_ENABLE_EXAMPLE_GAME=true` (shared change request 2).
- Session and campaign contracts: request/response schemas for every route below; `gameId` in bodies and queries is any id matching the database's id pattern, so an unknown game is a `NOT_FOUND` from the registry, not a `VALIDATION` error.

**api:** the sessions and campaigns routes in ARCHITECTURE → API. Unknown game → `NOT_FOUND`; a game without a scorer → 422 (`VALIDATION` code, status 422); state parsed with `parseState`, score recomputed with the game's `score`, any client `scoreTotal` or `breakdown` ignored; campaign state validated by the game's `campaign.schema`. History pages are 20 per page, newest first (`played_at`, then `id`), cursor = opaque base64 of the last row's `played_at` and `id`; `best` and `average` cover all the user's completed sessions of that game.

**web**
- `LocalStore` and `ApiStore`, chosen by auth state (`useSessionStore()`). Guests have no history (`docs/PRODUCT.md` → Guests and accounts): `LocalStore.list` returns an empty page and `save` keeps only in-progress sessions and campaigns on the device.
- Score flow per `docs/UX.md` (score home, capture, review, result), with its state in `sessionStorage` (`tk:v1:flow:<gameId>`). Capture calls `detectBoard`; on `unavailable` or an error it says "Photo reading isn't available yet." and offers manual entry. "Try Sample Photo" lists the module's `samples` and is hidden when there are none.
- `/games/[gameId]/score/[[...slug]]` renders the module's `ScoreFlow` (with the slug) when it has one, else the default flow; `/campaign` renders its `Campaign`. Game slices never add routes.
- Guest save → sign-in → saved on return, without re-entry: the result is kept under `tk:v1:pending-save` in `sessionStorage`; `/auth/callback` calls `resumePendingSave()` (shared change request 5).
- History list (personal best, average) and read-only detail.
- The score-flow components in `docs/UX.md` → Components: `PhotoCapture`, `CornerEditor`, `SquareGridEditor`, `HexGridEditor`, `ConfidenceOutline`, `Counter`, `BreakdownList`, `BoardMiniature`, `SignInPrompt`.
- `detection_meta` per `kit/types.ts` → `DetectionMeta` (`corrected`: keys of detected values the user changed; `detected`: how many values were detected), computed from the draft and the confirmed state.

## UI states
Review with no low-confidence values (no banner), save failed (retry keeps the result), history pagination loading.

## Acceptance criteria
- [ ] Example game, signed in: manual entry → review → result → save → in history with the right total; the detail page matches.
- [ ] Guest: "Sign In with Google" saves after Google sign-in without re-entry; "Don't Save" stores nothing.
- [ ] Refreshing on review keeps the board.
- [ ] Square and hex editors render from a layout, report taps as `CellRef`s, and work by keyboard.
- [ ] A tampered `score_total` is ignored and the recomputed one stored.

## Tests
- core: grid geometry (neighbors, components, distances, diameter including a branched river like the `HAR-WATER-A-1` example), breakdown, `parseState` (upgrade path and invalid state), example scorer, contracts.
- api: save/list/get/patch against local Supabase with the example game, tampered totals, unknown game, game without scorer, pagination with best and average, another user's session is `NOT_FOUND`, campaigns get/put with schema validation.

## Out of scope
Real games, CV (S2), rules (S3).

## Open questions
None open. Resolved from the docs:
- `detection_meta` shape: the stub said `{ corrected: CellRef[], fieldsChanged: string[] }`, but `kit/types.ts` (frozen by S0) already defines `DetectionMeta` as `{ corrected: string[], detected: number }`, keyed like `ConfidenceMap`, which also gives the accuracy rate D-002 asks for. S1 uses the frozen type.
- "A game without a scorer → 422": every real game has `features.scorer`, but until its slice adds `score` the API answers 422.

## Decisions

## Shared change requests
S1 can't be wired up without these. Each is small and touches code no running slice owns; apply on `main`, then `scripts/worktrees.sh sync`.

1. **`packages/core/src/index.ts`**: export S1's modules: `./kit/define`, `./kit/square-grid`, `./kit/hex-grid`, `./kit/breakdown`, `./kit/state`, `./contracts/sessions`, `./contracts/campaigns`, `./games/_example`. Why: the API and web can only import `@tablekeeper/core`'s root barrel.
2. **`packages/core/src/kit/types.ts`** and **`packages/core/src/games/registry.ts`**: add `'_example'` to `GameId`; in the registry, keep `GAMES` as the four real games (library order, and the `GameIdSchema` test) but make `getGame` and `isGameId` also find `exampleGame` when `isExampleGameEnabled()` (both from `./_example`). Why: the API, hub layout and score routes look games up through `getGame`; S1's tests and e2e need the example game, and only when enabled.
3. **`apps/web/src/games/registry.ts`**: add `_example: exampleUi` (from `./_example`). Why: `GAME_UI` is a `Record<GameId, …>`, and the default flow needs the example game's `Editor`.
4. **`apps/api/src/app.ts`**: `v1.use(sessionsRouter(clients))` and `v1.use(campaignsRouter(clients))` (from `./routes/sessions` and `./routes/campaigns`). Why: mounts the new routes.
5. **`apps/web/src/app/auth/callback/page.tsx`**: after the session is confirmed, `const resumed = await resumePendingSave()` (from `@/lib/session-store`) and, when it returns a path, go there instead of the stored return address. Why: a guest's result is saved after Google sign-in without re-entry.
6. **`playwright.config.ts`**: add `NEXT_PUBLIC_ENABLE_EXAMPLE_GAME: 'true'` to the web server's `env`. Why: the S1 e2e test plays the example game.
