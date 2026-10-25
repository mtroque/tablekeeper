# P3: Patchwork token detection

**Status:** ⬜ stub · **Depends on:** P2

**Goal:** Count the praline chits laid out beside the box board, by value, and detect the special tile.

## Owns
The `patchwork` game folders (AGENTS.md → Parallel sessions).

## Scope (must cover)
- Candidates from `findBlobs` outside the board quad, filtered by size relative to the board.
- Token classes: 1, 5, 10 and 20 chits (`PAT-SCORE-4`) and the special tile. 1s by shape (round); 5, 10 and 20 by `matchTemplateRotInvariant` against the reference crops; the special tile as its own class.
- A 20 chit reference crop is still wanted (`docs/DATA_ASSETS.md` → References). The game has a single 20 chit and no fixture photo shows it.
- Touching chits split by distance transform; counts still in doubt are marked low-confidence.

## Acceptance criteria (draft)
- [ ] ≥ 95% of fixture photos get every count exactly right, and wrong counts are always flagged.
