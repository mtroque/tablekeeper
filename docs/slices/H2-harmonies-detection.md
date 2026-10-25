# H2: Harmonies photo detection

**Status:** ⬜ stub · **Depends on:** H1, S2

**Goal:** From a top-down photo, detect the board side and each space's top color, then ask only for the heights that can't be seen.

## Owns
The `harmonies` game folders (AGENTS.md → Parallel sessions).

## Scope (must cover)
- Board finding: the bottom of the board is curved, so it can't rely on a convex 4-gon (`findBoardQuad`). Find the straight top edge and its two corners, the two side edges, and the lowest point of the bottom curve, then build the board rectangle from them as defined in `docs/games/harmonies.md` → Board rectangle and grid placement. The rectangle's corners are the draft's `corners`.
- Side: warp to the board rectangle and compare with both empty references, `data/fixtures/harmonies/references/side-a.jpg` and `side-b.jpg`; pick the better match, with confidence.
- Hex positions come from the chosen side's layout and its grid placement in the game doc, not from detecting hexes in the photo.
- Top color per space (water, field, mountain, trunk, leaves, building, empty), plus "occluded" only when the top color really can't be seen.
- Animal cubes are translucent amber and usually leave the top token's color visible around them. Classify the top color through or around a cube; don't mark a space occluded just because a cube is on it.
- In photos that aren't straight down, tall stacks lean visibly away from their hex center. Sample each hex's center region, a little smaller than the hex, so a lean doesn't pull in a neighbor's color.
- Height prompts from `HAR-STACK-*`; "Reread Photo as Side X" reruns with the other layout.
- Sample photos per `docs/DATA_ASSETS.md`.

## Acceptance criteria (draft)
- [ ] `pnpm eval:cv harmonies`: the side is right on every fixture; ≥ 95% top-color accuracy.

## Fixtures
Finished boards on both sides and both side references, with labels: `data/fixtures/harmonies/` (`docs/DATA_ASSETS.md` → Fixtures).

## Open questions
- How often do animal cubes hide a top color completely on real end boards? Check the labeled fixtures (`cubes` vs `occluded`).
