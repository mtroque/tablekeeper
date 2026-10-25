# P1: Patchwork manual scorer

**Status:** 🟨 · **Depends on:** S1

**Goal:** A Patchwork: Valentine's Day player scores a finished box board by hand (spaces, praline chits, special tile) and sees exactly which empty spaces cost them points.

## Owns
The `patchwork` game folders (AGENTS.md → Parallel sessions):
- `packages/core/src/games/patchwork/`
- `apps/web/src/games/patchwork/`
- `docs/games/patchwork.md`, `data/fixtures/patchwork/`, `apps/web/public/samples/patchwork/`
- this spec, `tests/e2e/P1.spec.ts` and `apps/api/src/routes/sessions-patchwork.test.ts` (new)
- `tests/e2e/S0.spec.ts`: only the line asserting Patchwork's score page is "Coming Soon", which this slice makes untrue

## Scope

**core** (`packages/core/src/games/patchwork/`)
- `PatchworkStateSchema` exactly as `docs/games/patchwork.md` → Board coordinates: `board: 'red' | 'gray'`, `grid: boolean[81]` (true = covered, flat index `row * 9 + col`), `tokens: { one, five, ten, twenty }` (non-negative integers), `specialTile: boolean`. `stateVersion: 1` (the S0 placeholder was version 0 with no state, so there is nothing to upgrade). Initial state: red board, every space empty, no chits, no special tile.
- `PATCHWORK_LAYOUT`: a 9×9 `SquareLayout`.
- `scorePatchwork(state)` per `PAT-SCORE-1` to `PAT-SCORE-5`, three categories:
  - `pralines` "Pralines": pralines held (`PAT-SCORE-4`), note listing the chits counted.
  - `specialTile` "Special Tile": 7 or 0 (`PAT-SCORE-3`).
  - `emptySpaces` "Empty Spaces": −2 per empty space (`PAT-SCORE-2`), highlights exactly the empty spaces.
- `patchworkPralines(tokens)` and confidence key helpers: cells `"row,col"` (as `squareKey`), fields `board`, `tokens.one` to `tokens.twenty`, `specialTile`. P2 and P3 produce drafts with these keys.
- No contracts or API changes: S1's sessions API validates and rescores any registered game through its definition.

**web** (`apps/web/src/games/patchwork/`)
- `Editor` per the slice stub and `docs/UX.md` → Review / editor and Board color switch:
  - "Red" / "Gray" switch above the grid; the grid is drawn in that board's color. Switching never clears the board (P2 adds rereading a photo).
  - 9×9 `SquareGridEditor`; tap toggles a space between empty and covered (a chocolate piece drawn on it). Labels "Row 3, column 5: covered".
  - "All Covered" / "All Empty" set every space.
  - `Counter`s for praline chits worth 1, 5, 10 and 20, capped at the number of chits in the box (`PAT-SCORE-4`: 32, 12, 5, 1).
  - "Special Tile" toggle (`aria-pressed`).
  - Low-confidence values from a draft (any key above) are outlined.
- `Breakdown`: a `BoardMiniature` of the box board in its color, covered spaces in chocolate; the selected category's spaces are highlighted.
- `Motif` already exists (S0).

## UI states
- Every space covered: "Empty Spaces" shows 0 with the note "No empty spaces." and no highlights.
- Board switch shows the selected board as pressed; the grid color changes immediately.

## Acceptance criteria
- [ ] The worked examples in the game doc pass.
- [ ] The breakdown highlights exactly the empty spaces.
- [ ] Manual flow: Enter by Hand → editor (board switch, grid, All Covered / All Empty, chit counters, special tile) → running total → result with breakdown → saved game shows the same total (signed in).
- [ ] The API recomputes the Patchwork score and rejects an invalid board (wrong grid length).
- [ ] UI text uses the rulebook's words (box board, spaces, pralines, praline chits, special tile) and passes the copy lint.

## Tests
- core: one test per `PAT-*` rule, named with its id, plus every worked example; schema rejects a grid that isn't 81 long and negative chits.
- api (`sessions-patchwork.test.ts`): Patchwork save with a tampered total stores the recomputed score; a 80-space grid is `VALIDATION`.
- e2e `tests/e2e/P1.spec.ts`: the manual flow above with the rulebook's Scoring example (5 empty, 4×1 and 1×10, special tile: 11 points), highlights on the result, save and detail.

## Out of scope
Board, chit and special tile detection (P2, P3); verifying the 7×7 square (`PAT-SCORE-3`).

## Open questions
None open. Resolved from the docs:
- Where empty spaces are highlighted: the "Empty Spaces" category's `highlights`, so the shared breakdown and miniature need nothing new.
- Chit counter caps: the box counts in `PAT-SCORE-4`. The schema itself doesn't cap them, so a stored game is never rejected over a count.

## Decisions

## Shared change requests
None.
