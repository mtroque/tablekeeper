# P4: Patchwork piece colors on the read board

**Status:** ✅ · **Depends on:** P2

**Goal:** After a photo, each covered space on the box board is drawn in the color of the chocolate piece the photo shows there, so the player can compare the drawing with the table at a glance and spot a misread space.

## Owns
The `patchwork` game folders (AGENTS.md → Parallel sessions), plus this spec and `tests/e2e/P4.spec.ts`.

## Scope
Today a covered space is one flat chocolate fill (`apps/web/src/games/patchwork/colors.ts`), so a misread covered space looks just like a real one.

**Reading the colors** (`packages/cv/src/games/patchwork/piece-colors.ts`, plain TypeScript, no opencv, like Harmonies' `rereadAsSide`, D-064):
- `measureSpaceColors(image, corners)`: maps the warped board's pixels (the canonical 450px layout of `board.ts`) through the projective map onto the photo, samples it bilinearly every other pixel, and takes per space the median LAB of its middle (`CELL_INSET`, as `measure.ts`) and of a ring around it (55% to 85% of the space); the frame's median LAB comes from `frameBand()` with the same glare filter as `measure.ts`. Done once per photo and corners.
- `spaceColors(measured, board)`: the piece's color is the ring's, white balanced by the frame (linear RGB scaled per channel by the references' mean frame over the photo's, brightness gain softened to its square root within 0.5 to 2), as `#rrggbb`. A space `looksEmpty` when its middle, shifted by the frame difference as `classify.ts` shifts its color features, is within 5 (LAB) of a reference's empty space at its position or a rotated one. Synchronous and cheap, so a board switch recomputes it at once.
- Both exported from `@tablekeeper/cv/games/patchwork` (`measureSpaceColors`, `pieceColors`), loaded on demand on review.
- Details and numbers: `docs/games/patchwork.md` → Photo reading → Piece colors.

**Getting them to the editor** without touching the frozen `Draft` type: the patchwork `Editor` reads the flow (`useFlow('patchwork')`, as Harmonies' editor does). When the flow's source is a photo with corners, it loads the photo's pixels and the cv module once per mount (`useOnMount`) and keeps the measured colors in component state. Not saved, not in state, no effect on the score.

**Drawing:**
- A covered space that the photo also read as covered is drawn in its photo color, with a thin inner edge in a darker or lighter shade of that color (so neighboring pieces stay apart and a covered space is never just a flat board-colored square).
- A space the player covers by hand (photo read it empty), or any board without a photo (manual entry; history uses the breakdown miniature, unchanged), uses today's flat chocolate fill. A space the player uncovers shows the board color.
- A covered space whose photo color `looksEmpty` is drawn in its photo color with chocolate diagonal hatching, and its label says "covered, looks empty in the photo", so the likely misread stands out from both the empty spaces and the real pieces.
- Low-confidence spaces keep the warning outline over the color (`SquareGridEditor` draws it).
- No "Photo Colors" / "Plain" toggle: checked on all three samples, the colored grid reads as easily as the flat one (see Decisions).

## UI states
- Photo colors still loading (the pixels decode for a moment after review opens): the flat fill, as today; colors replace it when ready, with no layout change.
- Reading the colors fails: the flat fill, silently (the board is still correct, only less informative); the error is logged.

## Acceptance criteria
- [x] With a sample photo, covered spaces are drawn in colors matching the pieces in the photo (checked by eye on all three samples; screenshot noted in the spec). `tests/e2e/P4.spec.ts` saves the grid of each sample (`test-results/P4-each-sample-*/try-sample-photo-{1,2,3}.png`); compared by eye with `apps/web/public/samples/patchwork/`: sample 1 shows the purple, yellow green and yellow waffle pieces, sample 2 the blue pieces at the left and brown ones at the bottom, sample 3 the blue, green, teal and orange pieces. The e2e test also checks every covered space gets a photo color and that they differ (over 20 distinct colors per sample).
- [x] Manual entry and history look as they do today. Manual: the e2e test covers all 81 spaces by hand and finds only the plain fill (same classes and colors as before). History draws `breakdown.tsx`, unchanged by this slice.
- [x] Tapping a space still toggles it; uncovered spaces show the board color. E2E: covering an empty space by hand draws the plain fill and updates the count; uncovering a photo piece leaves no fill (the board); covering it again brings its photo color back.
- [x] Reading the colors adds under 100ms on a 1200px photo (measured). Node, `red-board.jpg` (915×1200): 14 to 26ms, asserted under 100ms in `piece-colors.test.ts`. Browser (Chromium, dev build), recorded by a `performance.measure` in `use-photo-colors.ts` and asserted in the e2e test: 61, 64 and 27ms for the three samples (the first read in a fresh page runs coldest; the median is asserted).
- [x] Unit test: the color reader returns 81 colors for a fixture, and a known covered space's color is near its labeled piece color. `piece-colors.test.ts`: 81 colors on fixtures 02 and 01, and five pieces labeled by eye (purple, yellow green, blue, green, teal) read in their hue.
- [x] A covered space whose photo color is close to the board's empty color is hatched and labeled; tested in the color reader (an empty space marked covered `looksEmpty`, a real piece not) and in the editor e2e. Unit: 65 of 82 labeled empty spaces look empty and 14 of 566 covered ones (11 on the glare photo); e2e: with every space marked covered, 5 to 14 are hatched and exactly those are labeled "covered, looks empty in the photo".

## Tests
- `packages/cv/src/games/patchwork/piece-colors.test.ts`: 81 colors on two fixtures at their labeled corners; known pieces in their hue; light correction (a warm cast is taken out, a dimmer photo is half corrected); `looksEmpty` on most labeled empty spaces and few covered ones across the fixtures; timing on a 1200px photo; the color conversions.
- `tests/e2e/P4.spec.ts`: each sample's review shows colored covered spaces (with the timing); tapping covers with the plain fill and uncovers to the board; a covered space that looks empty is hatched and labeled; manual entry draws only the plain fill.

## Out of scope
- Snapping to a chocolate palette (raw, light-corrected color is truer and can't hide a wrong piece).
- Colors in history or the breakdown miniature (no photo there).

## Open questions
- Raw photo color or palette? Resolved: raw, light-corrected (see Out of scope).

## Decisions
- A piece's color is the median of a ring around the space's middle, white balanced by a per-channel frame gain with the brightness softened to its square root (0.5 to 2), instead of the stub's middle median shifted in LAB. Checked by eye on the samples: the middle of most spaces is a printed praline (sample 3's blue and teal pieces came out tan and lavender), and the additive LAB shift washed pieces out to pastel where the frame is in shadow (fixture 01's frame needs a gain of 7). The looks-empty check keeps the middle and the LAB shift, which is what the empty references hold.
- A covered space that looks empty is marked by chocolate hatching and its label, not by color alone (docs/UX.md → Accessibility). The threshold, LAB distance 5 from a reference's empty space, flags 65 of 82 empty spaces and 14 of 566 covered ones on the labeled fixtures; 11 of those are white chocolate under glare on 06, which color can't tell from the gray board, and which are mostly low confidence anyway. A space the player covered by hand is never hatched (it uses the plain fill).
- The colors are measured once per review mount in the patchwork editor (`useFlow` and `useOnMount`, as Harmonies' reread reads the flow), and corrected for the current board on every render; never in `Draft` (frozen) or the state.
- No "Photo Colors" / "Plain" toggle: the colored grid reads as easily as the flat one on all three samples, and the warning outline and hatching stay visible on it.
- The projective map from the warped board to the photo is a copy of Harmonies' `squareToQuad` in the patchwork folder rather than an import across game folders; moving it to `packages/cv/src/pipeline/` is a possible shared change, not needed now.
- No additive wiring outside the patchwork folders: the new exports are in `packages/cv/src/games/patchwork/index.ts`.

## Corrections

| Date | Pattern | Where | What was wrong | Correction | Source | Status |
|---|---|---|---|---|---|---|
| 2026-11-26 | `doc-code-drift` | `docs/games/patchwork.md` → Layout | Said each space is sampled in its middle 40% (`CELL_INSET` 0.3), but `insetPolygon` keeps 1 − 0.3 of the size, so `measure.ts` samples the middle 70% each way | Doc corrected while P4 mirrored the sampling | self | |

## Shared change requests
None.
