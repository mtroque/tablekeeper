# H5: Harmonies Crescendo, board sides C and D

**Status:** ⬜ · **Depends on:** H4

**Goal:** Players using Crescendo's new personal boards can score Side C (no center space, richer buildings) and Side D (dry spaces, richer trees and fields) by hand.

## Owns
The `harmonies` game folders (AGENTS.md → Parallel sessions), plus this spec and `tests/e2e/H5.spec.ts`.

## Source
Crescendo rulebook pp. 8 and 9 (URL and page note in H4 → Source, then in `docs/games/harmonies.md`).

## Scope (must cover)
- **Rules** into `docs/games/harmonies.md` with ids, our own words. Read at planning:
  - Side C: no space at the board's center; nothing can be placed there. A building scores 8 if its neighbors' top tokens show at least 4 different colors (red counts), else 0. Everything else as Side A (rivers by length).
  - Side D: some spaces are printed dry. A dry space becomes ordinary when it is adjacent to water. A tree on an ordinary space scores by height 2 / 4 / 9 (verify which stacks: the art shows four trees scored 0, 2, 4, 9); a tree on a dry space at the end scores 0. A field (2 or more connected yellow tokens) scores 6 if at least one of its tokens is on an ordinary space, else 0. Everything else as Side A.
- **⚠️ VERIFY before building (stop and ask if unresolved):**
  - Side C and D layouts: the column shapes, which space is "the center" on C, and which spaces are dry on D. The rulebook art (pp. 8 and 9) is too small to transcribe safely; needs a straight-down photo of each side (`data/fixtures/harmonies/references/side-c.jpg`, `side-d.jpg`, per `docs/DATA_ASSETS.md`) or the player's transcription.
  - Side D trees: whether the "0" tree in the art is leaves alone or trunks only; which stacks score 2, 4, 9.
  - Side D "adjacent to Water": any neighbor whose top is water, at the end of the game (assumed).
  - Side B islands are not mentioned for C or D: assume C and D score water as Side A, as the rulebook says.
- **Layouts** in `packages/core/src/games/harmonies/layout.ts`; dry spaces as part of the D layout (not state). The board drawing shows dry spaces (a drawn texture or tint from the game's own palette, not color alone; label in the cell's accessible name), and shows a dry space as ordinary once a water neighbor is placed.
- **State:** `side: 'A' | 'B' | 'C' | 'D'`. Adding values keeps old states valid; decide on a version bump in the spec.
- **Side switch:** four sides, grouped Base Game (A, B) and Crescendo (C, D), shown only when the Crescendo boards module is on (H4's module section). Photo reading stays A and B only: choosing C or D after a photo offers "Clear Board" / "Cancel" (no reread).
- Breakdown notes for the new rules ("2 trees on dry spaces score 0").

## Acceptance criteria (draft)
- [ ] Side C board has no center space and can't be tapped there.
- [ ] Side C: a building with 4 different neighbor colors scores 8; with 3, 0.
- [ ] Side D: `TTL` on an ordinary space scores 9 (per the verified table); on a dry space with no water neighbor, 0; placing water next to it makes it 9.
- [ ] Side D: a field of 2 on dry spaces scores 0; with one token on an ordinary space, 6.
- [ ] Worked examples from the rulebook's p. 8 and p. 9 examples pass as tests.
- [ ] History shows C and D boards correctly.

## Out of scope
- Photo detection of sides C and D (Later).

## Open questions
- Does the module section switch on "New Boards" separately, or is it one "Crescendo" switch for all three modules?

## Decisions

## Shared change requests
