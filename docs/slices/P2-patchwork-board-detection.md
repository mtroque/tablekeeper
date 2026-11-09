# P2: Patchwork board detection

**Status:** ✅ · **Depends on:** P1, S2

**Goal:** Pre-fill the 9×9 grid from a photo: the app finds the box board, tells red from gray, reads every space as empty or covered, and outlines the spaces it isn't sure of, so the player only checks those.

## Owns
The `patchwork` game folders (AGENTS.md → Parallel sessions):
- `packages/cv/src/games/patchwork/` (detector, calibration `references.json`, tests)
- `apps/web/src/games/patchwork/` (`detector.ts` loader, `samples`, Editor)
- `docs/games/patchwork.md`, `data/fixtures/patchwork/`, `apps/web/public/samples/patchwork/`
- this spec and `tests/e2e/P2.spec.ts`

## Scope

**Finding the board** (`find-box-board.ts`). Rough outlines come from color segmentation (table colors learned from the photo's border by k-means, at two lightness weights) and from S2's `findBoardQuad`; each side is then moved to the outermost nearby straight color edge, and the outline whose sides are best covered wins. No outline: S2's centered fallback and its warning.

**Layout** (`board.ts`): the board warped to 450×450; 81 spaces inside the frame at the inset in `docs/games/patchwork.md` → Boards; each space sampled in its middle 40% (`CELL_INSET` 0.3).

**Measuring a space** (`measure.ts`): median L, a*, b*; the interquartile range of each; and the 75th percentile of the lightness gradient. Medians and interquartile ranges, not means and standard deviations, because pieces don't sit exactly on the grid and a neighbor's banderole or shadow often reaches into a space. Raw LAB, not S2's `normalizeLighting` (see Decisions). The frame's median color is measured from a band along each side.

**Empty or covered** (`classify.ts`): each space's distance to the nearest of 12 empty samples (3 references × 4 positions: its own and where it would be if the board were turned 90°, 180° or 270°, D-016), in units of each feature's spread across that board's references. Before comparing, the color features are shifted by the difference between the reference's frame and this photo's frame, which compensates for the light. Covered when the distance is over the board's threshold. Confidence is 0.5 at the threshold and reaches 1 at 1.5 times (or a 1.5th of) it, on a log scale.

**Board color**: from the frame's a*: over the calibrated midpoint is red. Confidence 0.5 at the midpoint, 1 at half the calibrated gap from it.

**Glare**: a pixel is a reflection candidate when it's unsaturated (chroma under 12) and at least 28 lighter than the frame; a space is glare when 40% of its pixels are candidates and it is unusually smooth (lightness IQR under 8, gradient under 5). A glare space's confidence is capped at 0.4, so it's always outlined, and the capture step warns "N spaces have glare. Check them, or retake the photo away from overhead light."

**Calibration** (`calibrate.ts`, stored in `references.json`): the 6 empty references measured where the finder puts them; per board, the feature spreads and the threshold that best separates the labeled fixtures' spaces (measured both at their labeled corners and at the found ones), placed in the middle of the widest gap; the frame's a* midpoint. Built by `pnpm eval:cv patchwork --calibrate`, which runs `cvGame.calibrate` (shared change request 1).

**Draft**: `state` is `{ board, grid, tokens: all 0, specialTile: false }` (chits and the tile are P3); `confidence` has the 81 `"row,col"` keys and `board` (D-046).

**Web**: `detector.ts` loads `@tablekeeper/cv/games/patchwork` in the worker; two sample photos, one of each board. **Board switch** (`editor.tsx`, `docs/UX.md` → Board color switch): with a photo, the Editor calls `reread({ board })` (shared change request 2) and the detector reads the spaces against that board's references (`DetectOptions.hints.board`, validated against the two boards; anything else is ignored). The player's chit counts and special tile are kept, since P2 doesn't read them. Without a photo the color just changes, as in P1.

## UI states
Beyond `docs/UX.md` → Screen states, all on the shared capture and review screens:
- Capture, glare found: the glare warning above Read Board.
- Review from a photo: uncertain spaces and an uncertain board color outlined, with the count in the banner.
- Board switch while reading: "Reading the spaces." under the grid, and the board section (switch, spaces, All Covered and All Empty) disabled so no tap is overwritten by the new reading. On failure: "Couldn't reread the photo. Check the spaces." in a warning banner, the new color kept, the spaces as they were.

## Acceptance criteria
- [x] `pnpm eval:cv patchwork`: board color right on every fixture; ≥ 97% cell accuracy on each board separately; ≥ 80% of errors flagged low-confidence. *Board found 8 of 8, corner error mean 1.1%, worst 2.8% (`07-gray-dark-wood`). Spaces 100% on each board (324 of 324 red, 324 of 324 gray), board color 8 of 8, so there are no errors to flag. 1.5% of correct spaces flagged: the 9 glare spaces in 05 and 06, and one covered red space close to the threshold in 01. About 0.7 to 0.8 s per photo in Node. The thresholds are fit on these same photos, so the numbers were also checked leaving each photo out of calibration and reading it: 0 errors on either board, board color right on all 8 (01 at 0.71 confidence).*
- [x] Accuracy holds on photos taken from different sides of the board and on nearly full boards. *The fixtures' labels don't record which side they were shot from, and the printed shading is too faint per space to tell, so every fixture was also turned 90°, 180° and 270° (moving the board's shading and the light to other positions) and read with the finder: 1,944 of 1,944 spaces and 24 of 24 board colors right. Nearly full boards: 01 (5 empty spaces), 04 (7) and 03 (8) read perfectly. `detector.test.ts` also reads synthetic boards turned 180° under warm light against references shot at 0°, 90° and 180°.*
- [x] Photo → corners → review shows the draft with uncertain cells outlined. *`tests/e2e/P2.spec.ts`: the red sample reads 14 empty spaces (-28 Points) with nothing outlined, and a tap still edits the draft; the gray sample shows the glare warning on the capture screen, then "4 values to check." and exactly 4 outlined spaces, the first "Row 1, column 1: empty".*
- [x] Glare is never classified confidently. *`classify.test.ts` caps a glare space at 0.4 and doesn't call textured light pieces glare; on the fixtures the 9 glare spaces (05: 5, 06: 4) are all outlined.*
- [x] Detection leaks no `Mat`s. *`detector.test.ts`: a found board, given corners and an abort mid-read leave 0 live tracked Mats.*
- [x] The board switch rereads a photo against the other board, keeping the chits and special tile. *`tests/e2e/P2.spec.ts`: on the red sample with a chit of 5 and the special tile set, switching to Gray rereads the photo (the empty count changes from 14; against the gray references the red board reads as nearly full), the board isn't outlined, and the chit and tile stay; switching back to Red gives 14 empty spaces again and -16 Points. With rereads made to fail after 800ms, "Reading the spaces." shows and the spaces are disabled meanwhile, then the failure banner, Gray kept, 14 empty spaces, and the spaces enabled again. `detector.test.ts`: a hint reads against the named board with board confidence 1 and reads the spaces right when it names the true board; a hint naming no board is ignored.*
- [x] `pnpm eval:cv patchwork --calibrate` rebuilds the calibration. *It rewrote `references.json` byte for byte identical to the committed file (red threshold 5.39, gray 9.20, frame midpoint 3.617) and the eval that follows passes as above.*

## Tests
- `board.test.ts`: layout and rotated positions. `classify.test.ts`: rotation matching, frame compensation, confidence, glare, board color, calibration thresholds. `detector.test.ts`: synthetic photos end to end (calibrated from rendered empty boards), progress stages, given corners, fallback, abort, the committed calibration, leaks. `apps/web/src/games/patchwork/detector.test.ts`: the worker lookup loads it. The Editor's switch has no unit test (the web project has no component test setup, and the logic is small); `tests/e2e/P2.spec.ts` covers it, including the reading and failure states.
- Fixture accuracy is `pnpm eval:cv patchwork` (CONVENTIONS → Testing: CV).

## Out of scope
Praline chits and the special tile (P3); a per-game photo tip banner (UX names one for chits, which belongs with P3 and needs a `GameUiModule` field).

## Open questions
None. Resolved:
- Petits fours and pink or brown pieces do stand out from empty spaces on the red board, including under warm light (02, 04): 0 errors. The closest covered red space is 1.07 times the threshold and is outlined.
- Calibration storage and the board switch reread needed shared changes: requests 1 and 2 below, both applied on `main`.

## Decisions
- **Robust features.** Median LAB, the three interquartile ranges and the 75th percentile gradient, sampled in each space's middle 40%. Means, standard deviations and edge density at a 20% inset (the first prototype) made 7 errors on red and 2 on gray, mostly empty spaces with a neighbor's banderole or shadow in a corner; several were far from the threshold and couldn't have been flagged.
- **Raw LAB plus a frame shift, not `normalizeLighting`.** Gray-world white balance pulls the red board to neutral (15 and 17 errors per board). The frame is the same material in every photo, so shifting the color features by the frame difference compensates for the light; it widened the gap between empty and covered on red from 1.84 to 2.35 times.
- **Board color from the frame's a*,** not the whole board, whose average is dominated by the pieces. Measured: gray frames -2.6 to 0, red 7.2 to 18.4.
- **Glare needs smoothness too.** A lightness rule alone flagged 21 white chocolate and gold praline spaces on the red board, all read correctly; requiring a smooth space leaves only real glare.
- **Calibration in `references.json`,** not S2's `profile.json`: per-board, per-position empty references don't fit class centroids. `pnpm eval:cv --calibrate` runs `cvGame.calibrate` (request 1); `cvGame.measure` rejects, so nothing can build a generic profile for Patchwork by mistake.
- **The board pseudo-cell.** `read` returns a `board` reading next to the 81 spaces, so the eval's confusion matrix shows board color (classes `red` and `gray`); this makes the eval count 82 values per photo.
- **Detector progress:** `loading-opencv` (first time), `finding-board` (no corners given), `classifying` once the board is found; an abort is checked after each.
- **Samples** are fixtures 02 (red, `red-board.jpg`) and 06 (gray with glare, `gray-board.jpg`), downscaled to 1200px. Both read perfectly in Node and in the browser e2e.
- **No wiring edits.** The worker finds the detector through `apps/web/src/games/patchwork/detector.ts` (S4), which this slice owns; no registry, hub or test config line changed.

- **A board the player picks is certain.** A reread with `hints.board` reports board confidence 1, so the switch isn't outlined after the player chose it.
- **The reread keeps what P2 doesn't read.** `reread` replaces the whole state; the Editor remembers the chits and special tile before rereading and puts them back once the new board arrives. Taps on spaces made before the switch are replaced by the new reading, which is the point of rereading.
- **No taps during a reread.** The board section is a disabled `fieldset` while it runs (about a second), instead of staying editable as first planned, so an edit can't be silently overwritten.
- **`PatchworkCvGame`** narrows `read` (board option, richer reading) and `calibrate` (returns a `PatchworkCvGame`) by omitting them from `CvGame` and redeclaring them.

## Shared change requests

Both applied on `main`: `feat(cv): add a game calibrate hook to eval:cv (requested by P2)` and `feat(web): reread a board photo with a detector hint (requested by P2)`.


1. **Calibration hook for `pnpm eval:cv --calibrate`.**
   - *What:* an optional member on `CvGame` (`packages/cv/src/pipeline/game.ts`): `calibrate?(input: { references: Array<{ name: string; image: ImageInput; orientation?: number }>; items: Array<{ name: string; image: ImageInput; orientation?: number; corners?: Quad; label: Label }> }): Promise<{ files: Record<string, unknown>; summary: string[]; game: CvGame<State, Label> }>`. In `scripts/eval-vision.ts`, when `--calibrate` is given and the game has `calibrate`: decode every JPEG in `data/fixtures/<gameId>/references/` (named `references/<file>`), pass the labeled items with their parsed labels, write each returned file into `packages/cv/src/games/<gameId>/` as Prettier-formatted JSON, print the summary, and evaluate with the returned game. Otherwise keep today's generic profile path.
   - *Why:* Patchwork's calibration (empty references per board and position, plus thresholds) doesn't fit `Profile`, and today `--calibrate` would overwrite it with class centroids. `cvGame.calibrate` already has exactly this shape.
2. **Rereading a photo with a hint, for the board switch** (`docs/UX.md` → Board color switch).
   - *What:* `DetectOptions` (`packages/core/src/kit/types.ts`) gains `hints?: Record<string, string>`, a game-specific reading hint. `detectBoard` in `apps/web/src/lib/cv-client.ts` takes `hints` in its options and sends them in the `detect` message; `apps/web/src/workers/cv.worker.ts` passes them to `detector.detect`. `EditorProps` (`apps/web/src/games/types.ts`) gains `reread?: (hints: Record<string, string>) => Promise<boolean>`, which `ReviewStep` provides when the flow has a photo and corners: it reads the photo at the flow's corners with the hints, and on success stores the new state, draft (state and confidence) and warnings; it resolves false on any `CvError`.
   - *Why:* the detector can't be told which board to read against, and the editor has no way to rerun a reading. After this lands, P2 finishes by reading `opts.hints?.board` in the detector (validated against the two boards, passed to `read`'s `board`) and calling `reread({ board })` from the Editor's switch, with the states under UI states.
