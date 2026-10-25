# D2: Dorfromantik campaign and unlocks

**Status:** 🟨 · **Depends on:** D1

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
- [ ] 142 points → Actress, 4 circles.
- [ ] Red Hearts can be unlocked at most 3 times.
- [ ] Undoing an unlock affects future games only.
- [ ] Starting a new campaign archives the old one; the next sheet is game 1 with no rows unlocked.

## Tests
- core: `addUnlocks` (once per item, hearts 1 to 3 across games, the fourth refused), `undoUnlock` (rows go, hearts count down), `campaignSummary`.
- e2e `tests/e2e/D2.spec.ts`: finish a 142 game (Actress, 4 circles), unlock Circus and 2 hearts, then 2 more hearts is refused (only 1 left); the next sheet shows the Circus and Red Hearts rows; undo Circus on the campaign page, the sheet loses the row and the saved game keeps its total.

## Out of scope
- Adding an unlock later from the campaign page (UX lists only removal there).
- Modeling the advancement track (D-009).

## Open questions
None open.

## Decisions

## Shared change requests
