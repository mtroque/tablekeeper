# H6: Harmonies Crescendo, Sanctuaries

**Status:** ⬜ · **Depends on:** H5

**Goal:** Players using Crescendo's Sanctuaries module can mark Sanctuaries on the board, each with its 2 colors, and have them scored from their neighbors.

## Owns
The `harmonies` game folders (AGENTS.md → Parallel sessions), plus this spec and `tests/e2e/H6.spec.ts`.

## Source
Crescendo rulebook pp. 4 to 7 (URL and page note in H4 → Source, then in `docs/games/harmonies.md`).

## Scope (must cover)
- **Rules** into `docs/games/harmonies.md` with ids, our own words. Read at planning:
  - Each Sanctuary tile allows one specific stack that is normally invalid (example on p. 5: blue on a height 2 mountain, then a second blue on top). Each has 2 token colors.
  - A completed Sanctuary scores 3 for each neighbor whose top token is either of its 2 colors (0 to 18).
  - A Sanctuary is not part of a river, mountain or field. For buildings and other Sanctuaries, a neighboring Sanctuary counts by its top token, completed or not.
  - Unfinished Sanctuaries score nothing and cost nothing.
  - Animal cubes on Sanctuaries only affect animal cards, which the player already enters as points.
- **No tile list (decided with the player, 2026-11-09):** the player marks a space as a Sanctuary and gives what scoring needs, not which tile it is:
  - **Completed or unfinished.** Unfinished means started but not done. It scores nothing, but it still isn't a river, mountain or field, and its top token still counts for its neighbors.
  - **Its 2 colors** (completed only), from the 6 token colors, two different ones.
  - **Its top color**, which neighbors see. Default it to one of the 2 colors (the p. 5 example's top is one of its colors) but allow any of the 6.
  This drops the need to transcribe the 10 tiles, at the cost of not checking that a color pair or stack matches a real tile.
- **Entry on the board:** the stack sheet gets a "Sanctuary" choice next to the stacks. Picking it shows Completed / Unfinished, then the 2 colors and the top color as color buttons with names. The board draws a Sanctuary as its top token with a distinct ring and two small marks in its colors (and a letter label under "Show Labels"), so it can't be mistaken for a mountain or building. Its accessible name says "Sanctuary, blue and gray, blue on top".
- **State:** e.g. `sanctuaries?: Record<string, { completed: boolean; colors?: [Piece, Piece]; top: Piece }>`, keyed like `stacks`; a space is either a stack or a Sanctuary, never both. Validated with Zod (colors different; `colors` required when completed). Optional field, so old states stay valid; decide on a version bump in the spec.
- Scoring with the new category "Sanctuaries", highlights on the miniature, and notes per Sanctuary ("Blue and gray: 4 matching neighbors"). Buildings, Side C buildings and other Sanctuaries read a Sanctuary's `top`. Works on every side, including C and D (p. 7: Sanctuaries and dry spaces are scored separately).
- **⚠️ VERIFY before building (stop and ask if unresolved):** how a Sanctuary counts for Side B islands (land or water by its top?) and for Side D irrigation (does a Sanctuary with water on top make neighbors ordinary?). The rulebook only says it isn't part of a river, mountain or field (p. 7).

## Acceptance criteria (draft)
- [ ] The p. 7 example (a blue and gray Sanctuary with 4 matching neighbors) scores 12.
- [ ] An unfinished Sanctuary scores 0, and its top color counts for a neighboring building.
- [ ] A Sanctuary with water on top next to water does not lengthen a river (test).
- [ ] A Sanctuary with a gray top next to a mountain doesn't make that mountain score (test).
- [ ] The sheet won't save a completed Sanctuary without 2 different colors.
- [ ] Module off: no Sanctuary choice in the sheet, and a board with Sanctuaries can't be saved (schema).
- [ ] e2e: mark a completed Sanctuary by hand and see its points in the breakdown.

## Out of scope
- Picking the exact Sanctuary tile or checking its stack.
- Photo detection of Sanctuaries.

## Open questions

## Decisions
- Sanctuaries are entered as colors (2 colors, top color, completed or not), not as one of the 10 tiles: that is all scoring reads, and it needs no tile transcription.

## Shared change requests
