# D2: Dorfromantik campaign and unlocks

**Status:** ⏸ (waiting on the shared change below: "Start New Campaign" needs a way to archive the active campaign) · **Depends on:** D1

**Goal:** After each game, record what the campaign unlocked and show its progress on a campaign page.

## Owns
The `dorfromantik` game folders (AGENTS.md → Parallel sessions):
- `packages/core/src/games/dorfromantik/`
- `apps/web/src/games/dorfromantik/`
- `docs/games/dorfromantik.md`, this spec, `tests/e2e/D2.spec.ts`

## Scope

**core**
- `addUnlocks(campaign, { ids, redHearts }, gameNumber)`: adds each item once, logs it with the game; Red Hearts adds that many hearts (one log entry each) and ticks `DOR-U-REDHEART` from the first. Fails (`Result`) on an item already unlocked or more than 3 hearts in all.
- `undoUnlock(campaign, logIndex)`: removes that log entry; for a heart, one heart less, and `DOR-U-REDHEART` goes when none are left. Past games are untouched (their extras are in their own sessions).
- `campaignSummary(campaign)`: games played, high score (best game total, null before the first game) and its rank (`rankFor`).

**web**
- The finish screen (D1) per `docs/UX.md` → Dorfromantik: total, rank title, "Cross off N circles on your campaign sheet.", then "Any Unlocks?": every campaign-sheet item by name, grouped by the sheet's sections, with items already unlocked shown as such; Red Hearts as one item with a stepper for hearts to add (up to 3 in all). "Save Unlocks" or "No Unlocks". Saved unlocks get one short highlight (none with reduced motion).
- Spoiler-safe: the picker shows names only. What an item adds to the scoresheet is shown only once it's unlocked (campaign page).
- `Campaign` at `/games/dorfromantik/campaign`: games played, high score, rank title; unlocks in the order they came, each with its game and "Undo" (a confirm dialog); hearts as "Red Hearts (2 of 3)"; "Start New Campaign" (a confirm dialog) archives the active campaign and starts an empty one.

## UI states
- Campaign page empty (no games yet): one sentence and "Score a Game".
- Guest: the campaign works on this device; a line says so (no sign-in wall, `docs/PRODUCT.md` → Guests and accounts).
- Saving unlocks failed: message and retry, picks kept. Undo failed: message, list unchanged.
- Finish screen with all items unlocked: "Everything is unlocked."

## Acceptance criteria
- [x] 142 points → Actress, 4 circles. (core `rankFor` and `campaignSummary` tests; e2e: the finish screen shows "142 Points", "Actress", "Cross off 4 circles on your campaign sheet.", and the campaign page shows high score 142, rank Actress.)
- [x] Red Hearts can be unlocked at most 3 times. (core: `addUnlocks` refuses a fourth heart and the campaign schema caps `redHearts` at 3; API test: a PUT with 4 hearts is a 400; e2e: after 2 hearts the stepper stops at 1 more, the campaign shows "Red Hearts (3 of 3)", and the next picker offers no stepper.)
- [x] Undoing an unlock affects future games only. (core: `undoUnlock` leaves `games` untouched and removes the row; e2e: undo Circus on the campaign page, the game 3 sheet has no Circus row, and history still lists the 142 game.)
- [ ] Starting a new campaign archives the old one; the next sheet is game 1 with no rows unlocked. **Blocked:** see Shared change requests. Not built; no button is shown until the store can do it.

## Tests
- core: `addUnlocks` (once per item, hearts 1 to 3 across games, the fourth refused), `undoUnlock` (rows go, hearts count down), `campaignSummary`.
- e2e `tests/e2e/D2.spec.ts`: finish a 142 game (Actress, 4 circles), unlock Circus and 2 hearts, then 2 more hearts is refused (only 1 left); the next sheet shows the Circus and Red Hearts rows; undo Circus on the campaign page, the sheet loses the row and the saved game keeps its total.

## Out of scope
- Adding an unlock later from the campaign page (UX lists only removal there).
- Modeling the advancement track (D-009).

## Open questions
None open.

## Decisions
- Red Hearts log one entry per heart, so each heart has its game and can be undone alone; the row goes with the last heart.
- Saving unlocks reads the campaign fresh and applies `addUnlocks` to it, so a stale page can't overwrite another tab's change; a refused pick (already unlocked) says so and clears the picks.
- The picker is shown once per finished game (`unlocksDone` in the sheet flow). "No Unlocks" just closes it. Adding an unlock later isn't offered (UX lists only removal on the campaign page).
- What an item adds ("Adds the Circus row to the scoresheet.") appears only on the campaign page, after it's unlocked; the picker shows names only.
- The campaign page's rank is the high score's rank, and before the first game it shows an empty state.
- Guests use the campaign on this device with a note saying so; no sign-in wall.
- No "Start New Campaign" button is shown while it can't work (no dead controls).

## Shared change requests
- **Archive the active campaign and start a new one.** Needed for "Start New Campaign" (scope; `docs/UX.md` → Dorfromantik; one active campaign per user, older ones archived).
  - What: `POST /v1/campaigns/:gameId/new` with `{ state, stateVersion }` (validated by the game's campaign schema) that sets `archived = true` on the active campaign and inserts the new one, in one transaction (the `campaigns_one_active` index allows only one), returning the new `Campaign`. Plus a contract in `packages/core/src/contracts/campaigns.ts` and `SessionStore.startCampaign(gameId, state, stateVersion)`: `ApiStore` calls the route; `LocalStore` replaces the device campaign with a new id (guests keep no archive, like no history, D-041).
  - Where: `apps/api/src/{routes,services,db}/campaigns.ts`, `packages/core/src/contracts/campaigns.ts`, `apps/web/src/lib/session-store/`.
  - Why: the current `PUT` only replaces the active campaign's state; nothing can set `archived`, so the old campaign and the sessions linked to it can't be kept apart from a new one.
  - Once it's on main: add the button and confirm dialog to `apps/web/src/games/dorfromantik/campaign.tsx` (reset the sheet flow after), and extend `tests/e2e/D2.spec.ts` to check the next sheet is game 1 with no rows.
