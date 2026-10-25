# H1: Harmonies manual scorer

**Status:** ⬜ stub · **Depends on:** S1

**Goal:** Score a finished board by hand on either side, with full stack editing, animal cards and Nature's Spirit cards.

## Owns
The `harmonies` game folders (AGENTS.md → Parallel sessions).

## Scope (must cover)
- Layouts, schema and scorer per `docs/games/harmonies.md` (`HAR-*`, Board layouts, State).
- `Editor`: hex grid, a stack sheet offering only valid stacks, the side dropdown per `docs/UX.md` → Board side switch, an animal-card list, and a Nature's Spirit list next to it (optional, `HAR-SPIRIT-1`).
- Breakdown: Nature's Spirit cards are their own category.

## Acceptance criteria (draft)
- [ ] The worked examples in the game doc pass.
- [ ] Switching side on a manually filled board offers only clear / cancel.
