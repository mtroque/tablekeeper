# D1: Dorfromantik scoresheet

**Status:** ✅ · **Depends on:** S1

**Goal:** Score a game on a digital scoresheet that shows only the rows the campaign has unlocked, and save it to the campaign.

## Owns
The `dorfromantik` game folders (AGENTS.md → Parallel sessions):
- `packages/core/src/games/dorfromantik/`
- `apps/web/src/games/dorfromantik/`
- `docs/games/dorfromantik.md`, this spec, `tests/e2e/D1.spec.ts`
- Additive wiring: one export line in `packages/core/src/index.ts`.

## Scope

**core** (`packages/core/src/games/dorfromantik/`)
- Game state and campaign state schemas exactly as `docs/games/dorfromantik.md` → State. `stateVersion` 0 (see Decisions).
- Ids: `UnlockId` (`DOR-U-*`) and `ExtraRowId` (`DOR-E-*`) as enums, with the section E rows (label, sheet hint, input kind, multiplier) and the unlock list (name, section, row it adds) as data.
- `scoreDorfromantik(state)`: S1, S2, S3 and H per the scoresheet table. Breakdown categories: Tasks (S1), Flags and Longest (S2), Unlocked Components (S3, only when the state has any extras), each with a note listing its parts. The scorer reads only the game state; which rows count is decided by what the sheet sent (see Decisions).
- `visibleRows(campaign)`: the section E rows the campaign has unlocked, in sheet order; `lockedRowCount(campaign)`.
- `nextGameNumber(campaign)`: games played + 1. `recordGame(campaign, { sessionId, gameNumber, total })`: appends once per session id.
- `campaign.initialState`: nothing unlocked, no hearts, no games.

**web** (`apps/web/src/games/dorfromantik/`)
- `ScoreFlow` at `/games/dorfromantik/score`: the scoresheet in the paper sheet's order (header: game number, date, optional player names; B tasks as per-type sums; C flags; D longest; E unlocked rows only with their hints, then "N rows still locked."); live subtotals S1, S2, S3 and the total.
- The sheet is kept in sessionStorage (`tk:v1:flow:dorfromantik`) so a refresh keeps it.
- "Finish Game" saves: loads the active campaign (creating one if there is none), saves a completed session with `campaignId` and the game number, then writes the campaign with the game recorded. The date is the session's `played_at` (set by the save). Guests: the campaign is on this device only (`LocalStore`), and guests have no history (S1, D-041).
- After saving: a result screen with the total and the breakdown, links to the saved game (signed in) and a new sheet. D2 extends this screen.
- `Breakdown` is not needed: the history detail's `BreakdownList` shows the categories and notes.

## UI states
- Campaign loading: skeleton sheet. Campaign failed to load: message and retry; the sheet isn't shown with a guessed game number.
- Saving; save failed (retry keeps the sheet and doesn't save the session twice); offline ("You're offline." on save).
- No rows unlocked: section E shows only the locked count.

## Acceptance criteria
- [x] A new campaign shows only base rows; unlocking Circus adds the Circus row. (core: `visibleRows` tests; e2e `tests/e2e/D1.spec.ts`: game 1 shows "15 rows still locked." and no Circus row; after Circus is added to the campaign the row appears, 14 locked, and "surrounded" adds 10.)
- [x] The worked examples in the game doc pass. (`packages/core/src/games/dorfromantik/index.test.ts`: rulebook example 60 with S1 42 and S2 18; 128 Coachman 3; 142 Actress 4; 99 Vagabond 1; Circus +10; Red Hearts 6 edges +6. The e2e test fills the rulebook example on the sheet and sees 42, 18 and 60.)
- [x] A saved game appears in history and raises the campaign's game count. (e2e: "Finish Game" shows 60 Points, the saved game opens from history with the same breakdown, the stored campaign has 1 game and the next sheet is Game 2; guests get Game 2 from the device campaign. API: `apps/api/src/routes/dorfromantik.test.ts` saves a linked session with a tampered total, stores 70, and records it in the campaign.)

## Tests
- core: every `DOR-*` scoresheet id and every worked example by id; schema bounds (red hearts 0 to 3, nonnegative counts); `visibleRows` for a new campaign and with Circus and Red Hearts unlocked; `recordGame` is idempotent per session.
- e2e `tests/e2e/D1.spec.ts`: signed in, fill the rulebook example (60), finish, see it in history, and the next sheet shows game 2. A campaign seeded with Circus shows the Circus row.

## Out of scope
The unlock picker, rank title and campaign page (D2).

## Open questions
None open.

## Decisions
- `stateVersion` stays 0: the S0 placeholder had no scorer, so the API refused every save and nothing exists at 0 to upgrade; S0's registry test also expects 0 for every game. Change it with the first real shape change.
- The scorer reads only the game state; it can't see the campaign. The sheet drops values of rows the campaign doesn't show (`withVisibleExtras`) before saving, and the API scores whatever extras it receives. Saved games keep their extras, so undoing an unlock later never changes a past score.
- The game number is recomputed from the campaign when the sheet is shown and when it's saved, so a sheet started before another game was saved can't reuse a number.
- Saving is two writes (session, then campaign). The saved session is kept in sessionStorage before the campaign write, so a retry only writes the campaign; `recordGame` ignores a session id it already has.
- A first game creates the campaign before the session, since the session links to it.
- Guests: the session isn't kept (D-041), the device campaign records the game, and the finish screen says so. A guest's campaign isn't moved to an account on sign-in (D-006).
- The high-score table and `rankFor` are in core already, so every worked example is tested here; D2 uses them.
- The sheet is in sessionStorage under `tk:v1:flow:dorfromantik` with its own small store (`use-sheet.ts`), since S1's `FlowState` has photo fields and no place for the saved game.
- Additive wiring: `packages/core/src/index.ts` exports `./games/dorfromantik`.
- The API test lives in `apps/api/src/routes/dorfromantik.test.ts` (a new file; no shared code changed).

## Shared change requests
None.
