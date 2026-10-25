# S1: Score flow, sessions and history

**Status:** ✅ · **Depends on:** S0

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
- `games/_example/`: a 3×3 "count covered cells" game for tests. State `{ cells: boolean[] }` (9 entries, row-major); one point per covered cell; no rules, no rulebook (`features.rules` false). It has photo scoring (S2's `_example` detector reads it; until then capture reports reading unavailable) and a campaign `{ gamesPlayed }`, only so the campaign routes and page have something to store. Its UI module adds an `editor-check` page under `/score` that shows both grid editors for tests. Registered only when `NODE_ENV=test` or `NEXT_PUBLIC_ENABLE_EXAMPLE_GAME=true`.
- Session and campaign contracts: request/response schemas for every route below; `gameId` in bodies and queries is any id matching the database's id pattern, so an unknown game is a `NOT_FOUND` from the registry, not a `VALIDATION` error.

**api:** the sessions and campaigns routes in ARCHITECTURE → API. Unknown game → `NOT_FOUND`; a game without a scorer → 422 (`VALIDATION` code, status 422); state parsed with `parseState`, score recomputed with the game's `score`, any client `scoreTotal` or `breakdown` ignored; campaign state validated by the game's `campaign.schema`. History pages are 20 per page, newest first (`played_at`, then `id`), cursor = opaque base64 of the last row's `played_at` and `id`; `best` and `average` cover all the user's completed sessions of that game.

**web**
- `LocalStore` and `ApiStore`, chosen by auth state (`useSessionStore()`). Guests have no history (`docs/PRODUCT.md` → Guests and accounts): `LocalStore.list` returns an empty page and `save` keeps only in-progress sessions and campaigns on the device.
- Score flow per `docs/UX.md` (score home, capture, review, result), with its state in `sessionStorage` (`tk:v1:flow:<gameId>`). Capture calls `detectBoard`; on `unavailable` or an error it says "Photo reading isn't available yet." and offers manual entry. "Try Sample Photo" lists the module's `samples` and is hidden when there are none.
- `/games/[gameId]/score/[[...slug]]` renders the module's `ScoreFlow` (with the slug) when it has one, else the default flow; `/campaign` renders its `Campaign`. Game slices never add routes.
- Guest save → sign-in → saved on return, without re-entry: the result is kept under `tk:v1:pending-save` in `sessionStorage`; `/auth/callback` calls `resumePendingSave()`.
- History list (personal best, average) and read-only detail.
- The score-flow components in `docs/UX.md` → Components: `PhotoCapture`, `CornerEditor`, `SquareGridEditor`, `HexGridEditor`, `ConfidenceOutline`, `Counter`, `BreakdownList`, `BoardMiniature`, `SignInPrompt`.
- `detection_meta` per `kit/types.ts` → `DetectionMeta` (`corrected`: keys of detected values the user changed; `detected`: how many values were detected), computed from the draft and the confirmed state.

## UI states
Review with no low-confidence values (no banner), save failed (retry keeps the result), history pagination loading.

## Acceptance criteria
- [x] Example game, signed in: manual entry → review → result → save → in history with the right total; the detail page matches. (`tests/e2e/S1.spec.ts`, first test.)
- [x] Guest: "Sign In with Google" saves after Google sign-in without re-entry; "Don't Save" stores nothing. (e2e: the test stops at Supabase's authorize request, returns to `/auth/callback` signed in, and lands on the saved game with the right total; "Don't Save" leaves no `tk:v1:` keys in either storage. The real Google consent screen needs a person and wasn't run.)
- [x] Refreshing on review keeps the board. (e2e, first test: reload keeps the covered cells and the running total.)
- [x] Square and hex editors render from a layout, report taps as `CellRef`s, and work by keyboard. (e2e on `/games/_example/score/editor-check`: pointer taps, arrow keys, Enter and Space; low-confidence cells carry the dashed outline.)
- [x] A tampered `score_total` is ignored and the recomputed one stored. (`apps/api/src/routes/sessions.test.ts`: a save with `scoreTotal: 999` stores 4, read back with the service role; a patch with `scoreTotal: 0` stores 7.)

## Tests
- core: grid geometry (neighbors, components, distances, diameter including a branched river like the `HAR-WATER-A-1` example), breakdown, `parseState` (upgrade path and invalid state), example scorer, contracts.
- api: save/list/get/patch against local Supabase with the example game, tampered totals, unknown game, game without scorer, pagination with best and average, another user's session is `NOT_FOUND`, campaigns get/put with schema validation.

## Out of scope
Real games, CV (S2), rules (S3).

## Open questions
None open. Resolved from the docs:
- `detection_meta` shape: the stub said `{ corrected: CellRef[], fieldsChanged: string[] }`, but `kit/types.ts` (frozen by S0) already defines `DetectionMeta` as `{ corrected: string[], detected: number }`, which also gives the accuracy rate D-002 asks for. S1 uses the frozen type (what the keys are: see Decisions).
- "A game without a scorer → 422": every real game has `features.scorer`, but until its slice adds `score` the API answers 422.

## Decisions
- `DetectionMeta` keeps S0's frozen shape (`corrected` keys plus a `detected` count) rather than the stub's `CellRef[]` and field names; one key space covers cells and fields, and it gives an accuracy rate.
- Request schemas take any id matching the database pattern, so an unknown game is `NOT_FOUND` from the registry; response schemas only accept registered ids.
- A save request strips unknown keys, so a client-sent `scoreTotal` or `breakdown` never reaches the service.
- `defineGame<State>()` erases a game's state type for the registry; shared code only scores state it parsed with that game's schema.
- The example game reads `process.env` in core (declared locally, since core has no Node types), guarded so a bare worker treats it as disabled.
- Additive wiring (AGENTS.md → Parallel sessions → Additive wiring), lines added only:
  - `packages/core/src/index.ts`: exports for `kit/define`, `kit/square-grid`, `kit/hex-grid`, `kit/breakdown`, `kit/state`, `contracts/sessions`, `contracts/campaigns` and `games/_example`.
  - `packages/core/src/games/registry.ts`: `getGame` and `isGameId` also find the example game when `isExampleGameEnabled()`; `GAMES` stays the four real games.
  - `apps/web/src/games/registry.ts`: adds `_example` to `GAME_UI` when the example game is enabled.
  - `apps/api/src/app.ts`: mounts `sessionsRouter` and `campaignsRouter`.
  - `apps/web/src/app/auth/callback/page.tsx`: calls `resumePendingSave()` after sign-in and goes to the path it returns.
  - `playwright.config.ts`: `NEXT_PUBLIC_ENABLE_EXAMPLE_GAME: 'true'` for the web server.
- Corrections in `detection_meta` are the state paths that differ between the photo draft and the saved board (`cells.4`), and `detected` counts the draft's confidence entries. Shared code can't map a game's confidence keys to its state; manual entry saves no meta.
- `LocalStore` keeps only in-progress sessions and campaigns, and `list` is always empty, since guests have no history. A completed guest result is never stored on the device; it reaches an account only through the pending save.
- The flow state is read with `useSyncExternalStore`, so the server render shows a skeleton and the client reads sessionStorage. After a save, the flow is cleared without a re-render (`discard`), so the result step doesn't treat the board as lost and send the player home before the saved game opens.
- The history detail page draws the board through the module's optional `Breakdown` (a `BoardMiniature` for the example game) above the shared `BreakdownList`.
- The S1 e2e test creates and deletes its own user per worker instead of the seeded `e2e@local`: S0's sign-out test signs that user out everywhere, which ended S1's sessions mid-test when files ran in parallel.
- `'_example'` isn't added to `GameId` (`kit/types.ts` stays frozen): the example game's id is cast to `GameId`, and the web registry adds its entry through a widened view of `GAME_UI`. Both are confined to the example game.

## Shared change requests
None.
