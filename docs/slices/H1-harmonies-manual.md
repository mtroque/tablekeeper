# H1: Harmonies manual scorer

**Status:** ✅ · **Depends on:** S1

**Goal:** a Harmonies player scores a finished board by hand on either side, with full stack editing, animal cards and Nature's Spirit cards, and gets a breakdown that shows where every point came from.

## Owns
The `harmonies` game folders (AGENTS.md → Parallel sessions):
- `packages/core/src/games/harmonies/` (definition, layouts, stacks, scorer, tests)
- `apps/web/src/games/harmonies/` (Editor, Breakdown, Motif, piece colors)
- `docs/games/harmonies.md`, `data/fixtures/harmonies/`
- `apps/api/src/routes/sessions-harmonies.test.ts` (new file: API recompute for a Harmonies board)
- `tests/e2e/H1.spec.ts`, this spec

No `packages/cv` or `apps/web/public/samples` work (H2).

## Scope

**core** (`packages/core/src/games/harmonies/`)
- `layout.ts`: `HARMONIES_LAYOUTS` for sides A (23 spaces) and B (25 spaces) as `HexLayout`s, from `docs/games/harmonies.md` → Board layouts, plus the grid placement table (H2 uses it).
- `stacks.ts`: the piece codes, `VALID_STACKS` (the 14 stacks allowed by `HAR-STACK-1` to `HAR-STACK-4`), `isValidStack`, and each stack's spoken name for labels.
- `state.ts`: `HarmoniesStateSchema` per the game doc's State: every key a space of that side, every stack valid and non-empty (a missing key is an empty space), card points whole numbers from 0 to 999. `stateVersion` 1 (the S0 placeholder was 0 with `null` state, which nothing could save, so there is no upgrade step).
- `scoring.ts`: `scoreHarmonies` with one category per scoring kind, each with highlights and a note where the result isn't obvious: `trees`, `mountains`, `fields`, `buildings`, `water`, `animals`, and `spirits` (only when at least one Nature's Spirit card is entered).

**web** (`apps/web/src/games/harmonies/`)
- `Editor`: a "Board Side" dropdown (Side A / Side B) above the hex grid; the hex grid drawn from the side's layout, each stack as its round tokens; tapping a space opens a bottom sheet listing "Empty Space" and only the valid stacks; a "Show Labels" toggle that writes each stack's letters on its space; an "Animal Cards" list and a "Nature's Spirit Cards" list, each with a counter per card, a remove button and an add button.
- Side switch per `docs/UX.md` → Board side switch: an empty board switches at once; a board with any stack opens a sheet with "Clear Board" and "Cancel" only. Clearing keeps the cards, which don't depend on the side.
- `Breakdown`: a board miniature in top colors, highlighting the selected category's spaces.

## UI states
- Editor, empty board: the grid shows empty spaces, and each card list says what goes there and offers its add button.
- Side switch sheet (board has stacks).
- Stack sheet: the space's current stack is marked as selected.
- Breakdown without Nature's Spirit cards: no Nature's Spirit row.

## Acceptance criteria
- [x] The worked examples in the game doc pass. (`packages/core/src/games/harmonies/scoring.test.ts`: one test per example and per `HAR-*` rule, 40 tests.)
- [x] Switching side on a manually filled board offers only clear / cancel. (e2e, second test: the sheet's buttons are exactly Clear Board, Cancel and the sheet's Close; Cancel keeps side B and its water, Clear Board gives an empty side A and keeps the animal card. An empty board switches with no sheet.)
- [x] The stack sheet offers only valid stacks (`HAR-STACK-5`). (e2e: 15 options, Empty Space plus the 14 stacks; core tests reject every other stack.)
- [x] Signed in: manual entry of a board with animal and Nature's Spirit cards → result with the right categories → save → history detail with the same total. (e2e, first test: 16 points, trees 7, mountains 4, animal cards 3, Nature's Spirit 2, two mountains highlighted, saved detail shows 16.)
- [x] The API rejects an invalid Harmonies board and recomputes a tampered total. (`apps/api/src/routes/sessions-harmonies.test.ts`: `scoreTotal: 999` stores 34; `WR` is a 400 `VALIDATION` with the space's path.)

## Tests
- core: every `HAR-*` rule by id, every worked example, schema rejections (unknown space, invalid stack, empty stack, bad side).
- api: one save of a Harmonies board (recomputed total) and one invalid board (422 or 400 `VALIDATION`).
- e2e: `tests/e2e/H1.spec.ts`, main flow plus the side switch.

## Out of scope
Photo detection, height prompts after detection, the "Reread Photo as Side X" option of the side switch (H2).

## Open questions
None open. Resolved from the docs:
- Lone `R`, `T` and `TT` are valid stacks that score nothing (`HAR-STACK-3`, `HAR-STACK-4`), so the sheet offers them.
- `MR` is a building, not a mountain: mountains are stacks of gray tokens only (`HAR-STACK-2`), so `HAR-MTN-2` counts only `M`, `MM`, `MMM` neighbors.
- Side B with every space water would have no island; `HAR-WATER-B-1` says there is always at least 1, so the scorer counts at least 1.

## Decisions
- `stateVersion` is 1 with no `upgrade`: S0's placeholder (version 0, `null` state) could never be saved, so nothing stored needs upgrading.
- Core names exported through the package barrel carry the game's name where another game could clash (`HarmoniesPiece`, `HARMONIES_STACKS`, `harmoniesRiverPoints`, `isHarmoniesMountain`, `isHarmoniesBuilding`); Dorfromantik has rivers too.
- A mountain is a stack of gray tokens only; `MR` is a building, so it is neither a mountain nor a mountain neighbor (`HAR-STACK-2`, `HAR-STACK-4`).
- Side B counts at least 1 island even if every space is water, as `HAR-WATER-B-1` says.
- Breakdown highlights: side A water lights the longest river; side B water lights every land space (the islands). Mountains and buildings light only the ones that scored.
- The Nature's Spirit row appears only with at least 1 card; removing the last card drops `spiritCards` from the state rather than storing an empty list.
- Card points are whole numbers from 0 to 999. A new card starts at 0 and uses the shared `Counter` (hold the value to type a number).
- Switching side clears the stacks but keeps the cards, which don't depend on the side. A board from a photo gets the same Clear Board / Cancel sheet until H2 adds "Reread Photo as Side X".
- Spaces are named "Column N, Space M" (column from the left, space down that column, both from 1), in cell labels and the stack sheet title.
- Piece colors moved to `apps/web/src/games/harmonies/pieces.tsx`; the motif now reads them from there.
- Additive wiring: `packages/core/src/index.ts` gains `export * from './games/harmonies';`.
- Verified visually on a 390px viewport (editor with labels, stack sheet, side switch sheet, result): flat, bordered, token colors only inside the board, no dashes or emoji.

## Shared change requests
- **What:** in `packages/core/src/games/registry.test.ts`, the per-game test asserts `expect(game.stateVersion).toBe(0)`. Change it to `toBeGreaterThanOrEqual(0)` (or drop the line).
- **Why:** version 0 was S0's placeholder; every game slice moves its game to version 1 when it defines the real state, so this line fails for Harmonies now (`pnpm test`: 1 failure, `harmonies has an edition, an https rulebook and three starter questions`) and will for each other game. H1 doesn't own the file.
