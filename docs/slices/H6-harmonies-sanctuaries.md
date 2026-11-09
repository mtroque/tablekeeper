# H6: Harmonies Crescendo, Sanctuaries

**Status:** ⬜ · **Depends on:** H5

**Goal:** Players using Crescendo's Sanctuaries module can place completed Sanctuaries on the board and have them scored from their neighbors.

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
- **⚠️ VERIFY before building (stop and ask if unresolved):**
  - The 10 Sanctuaries: each one's stack (bottom to top) and its 2 colors. The rulebook shows only one; needs a photo of the 10 tiles (`docs/DATA_ASSETS.md`) or the player's list.
  - Whether a Sanctuary's stack can also count as a tree (e.g. leaves on top) or as land or water for Side B islands and Side D irrigation. The rulebook says only river, mountain and field (p. 7).
  - Whether an unfinished Sanctuary's partial stack is a valid ordinary stack for scoring (it would just score as what it is).
- **Entry on the board:** in the stack sheet, a "Sanctuary" group listing the 10 tiles' stacks (drawn like other stacks, 4 tokens tall). Picking one marks the space as that completed Sanctuary. The board draws it with a distinct marker so it isn't mistaken for a mountain or building.
- **State:** a Sanctuary stack is valid only as a listed tile's pattern; store which tile (e.g. `sanctuaries?: Record<string, SanctuaryId>`, or make the stack itself identify it; decide in the spec). Validation (`HAR-STACK-5`) allows a tile's stack only on a space marked with that tile; each tile at most once per board.
- Scoring with the new category "Sanctuaries", highlights on the miniature, and notes per Sanctuary. Works on every side, including C and D (p. 7: Sanctuaries and dry spaces are scored separately).

## Acceptance criteria (draft)
- [ ] The p. 7 example (a blue and gray Sanctuary with 4 matching neighbors) scores 12.
- [ ] A Sanctuary with water on top next to water does not lengthen a river (test).
- [ ] A building next to a Sanctuary counts the Sanctuary's top color (test).
- [ ] Only the 10 listed Sanctuary stacks are offered; the same tile can't be placed twice.
- [ ] Module off: no Sanctuary options in the sheet.
- [ ] e2e: place a Sanctuary by hand and see its points in the breakdown.

## Out of scope
- Tracking unfinished Sanctuaries (they score nothing).
- Photo detection of Sanctuaries.

## Open questions

## Decisions

## Shared change requests
