# P4: Patchwork piece colors on the read board

**Status:** 🟨 · **Depends on:** P2

**Goal:** After a photo, each covered space on the box board is drawn in the color of the chocolate piece the photo shows there, so the player can compare the drawing with the table at a glance and spot a misread space.

## Owns
The `patchwork` game folders (AGENTS.md → Parallel sessions), plus this spec and `tests/e2e/P4.spec.ts`.

## Scope
Today a covered space is one flat chocolate fill (`apps/web/src/games/patchwork/colors.ts`), so a misread covered space looks just like a real one.

**Reading the colors** (`packages/cv/src/games/patchwork/piece-colors.ts`, plain TypeScript, no opencv, like Harmonies' `rereadAsSide`, D-064):
- `measureSpaceColors(image, corners)`: maps each space's middle (the same canonical 450px layout and `CELL_INSET` as `measure.ts`) through the projective map from the warped board to the photo, samples the photo bilinearly, and takes the median L, a*, b* per space; the frame's median LAB comes from `frameBand()` with the same glare filter as `measure.ts`. Done once per photo and corners.
- `spaceColors(measured, board)`: shifts each space's color by the board references' mean frame minus this photo's frame (the light correction `classify.ts` uses, `docs/games/patchwork.md` → Photo reading), converts it to sRGB, and marks a space `looksEmpty` when its color, shifted per reference, is within a set LAB distance of that reference's empty space at its position or a rotated one (as `emptyDistance` does, color only). Synchronous and cheap, so a board switch recomputes it at once.
- Both exported from `@tablekeeper/cv/games/patchwork`, loaded on demand on review.

**Getting them to the editor** without touching the frozen `Draft` type: the patchwork `Editor` reads the flow (`useFlow('patchwork')`, as Harmonies' editor does). When the flow's source is a photo with corners, it loads the photo's pixels and the cv module once per mount (`useOnMount`) and keeps the measured colors in component state. Not saved, not in state, no effect on the score.

**Drawing:**
- A covered space that the photo also read as covered is drawn in its photo color, with a thin inner edge in a darker or lighter shade of that color (so neighbouring pieces stay apart and a covered space is never just a flat board-colored square).
- A space the player covers by hand (photo read it empty), or any board without a photo (manual entry; history uses the breakdown miniature, unchanged), uses today's flat chocolate fill. A space the player uncovers shows the board color.
- A covered space whose photo color `looksEmpty` is drawn in its photo color with chocolate diagonal hatching, and its label says "covered, looks empty in the photo", so the likely misread stands out from both the empty spaces and the real pieces.
- Low-confidence spaces keep the warning outline over the color (`SquareGridEditor` draws it).
- No "Photo Colors" / "Plain" toggle: checked on all three samples, the colored grid reads as easily as the flat one (see Decisions).

## UI states
- Photo colors still loading (the pixels decode for a moment after review opens): the flat fill, as today; colors replace it when ready, with no layout change.
- Reading the colors fails: the flat fill, silently (the board is still correct, only less informative); the error is logged.

## Acceptance criteria
- [ ] With a sample photo, covered spaces are drawn in colors matching the pieces in the photo (checked by eye on all three samples; screenshot noted in the spec).
- [ ] Manual entry and history look as they do today.
- [ ] Tapping a space still toggles it; uncovered spaces show the board color.
- [ ] Reading the colors adds under 100ms on a 1200px photo (measured).
- [ ] Unit test: the color reader returns 81 colors for a fixture, and a known covered space's color is near its labeled piece color.
- [ ] A covered space whose photo color is close to the board's empty color is hatched and labeled; tested in the color reader (an empty space marked covered `looksEmpty`, a real piece not) and in the editor e2e.

## Tests
- `packages/cv/src/games/patchwork/piece-colors.test.ts`: 81 colors on a fixture at its labeled corners; known spaces near hand-labeled piece colors; light correction (a uniformly dimmer photo gives the same colors); `looksEmpty` on every labeled empty space and on few covered ones across the fixtures; timing on a 1200px photo.
- `tests/e2e/P4.spec.ts`: a sample photo's review shows colored covered spaces; tapping an empty space covers it with the flat fill; uncovering shows the board color; manual entry draws only the flat fill.

## Out of scope
- Snapping to a chocolate palette (raw, light-corrected color is truer and can't hide a wrong piece).
- Colors in history or the breakdown miniature (no photo there).

## Open questions
- Raw photo color or palette? Resolved: raw, light-corrected (see Out of scope).

## Decisions

## Corrections

## Shared change requests
