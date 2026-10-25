# D1: Dorfromantik scoresheet

**Status:** ⬜ stub · **Depends on:** S1

**Goal:** Score a game on a digital scoresheet that shows only the rows the campaign has unlocked, and save it to the campaign.

## Owns
The `dorfromantik` game folders (AGENTS.md → Parallel sessions).

## Scope (must cover)
- Game and campaign schemas and the scorer per `docs/games/dorfromantik.md` (`DOR-*`, State).
- `ScoreFlow`: the scoresheet with live subtotals and each row's hint; unlocked rows only, plus a count of locked rows.
- Task points are entered as per-type sums, like the paper sheet.
- The sheet's header fields (`DOR-A`, `DOR-F`, `DOR-G`): the game number and optional player names are in the game state; the date shown is the session's `played_at`.
- Saving creates a session linked to the campaign; the game number is games played + 1.

## Acceptance criteria (draft)
- [ ] A new campaign shows only base rows; unlocking Circus adds the Circus row.
- [ ] The worked examples in the game doc pass.
- [ ] A saved game appears in history and raises the campaign's game count.
