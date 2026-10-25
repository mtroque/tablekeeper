# P2: Patchwork board detection

**Status:** 🟨 · **Depends on:** P1, S2

**Goal:** Pre-fill the 9×9 grid from a photo.

## Owns
The `patchwork` game folders (AGENTS.md → Parallel sessions).

## Scope (must cover)
- Layout (81 cells), canonical size, aspect bounds.
- Board corners from the outer frame, which contrasts strongly with the table. The 81 cells come from the frame-to-grid inset (`docs/games/patchwork.md` → Boards). That inset is approximate: confirm it on the fixtures and record the measured value in the game doc.
- Board color: after warping, pick red or gray from the board's average color, with a confidence. The editor's board switch reruns classification against the other board's references; the layout is the same, so nothing is lost.
- Empty vs covered: compare each cell with that board's empty references at the cell's own position and at the three positions it would occupy if the board were rotated 90°, 180° or 270°. The cell is empty if it matches any of the four within a tolerance calibrated per board, so the board's orientation is never needed.
- Glare (high lightness, low saturation, unusually smooth) is detected per cell; a cell with glare is marked low-confidence, never classified confidently.
- Profile calibrated from fixtures; sample photos per `docs/DATA_ASSETS.md`.

## Acceptance criteria (draft)
- [ ] `pnpm eval:cv patchwork`: board color right on every fixture; ≥ 97% cell accuracy on each board separately; ≥ 80% of errors flagged low-confidence.
- [ ] Accuracy holds on photos taken from different sides of the board and on nearly full boards.
- [ ] Photo → corners → review shows the draft with uncertain cells outlined.

## Open questions
- Do petits fours and pink or brown chocolate pieces stand out from empty spaces on the red board under warm light? Check the fixtures.
- **Calibration storage.** The empty references (per board, per position, 3 photos) don't fit S2's generic `Profile` (class centroids), and `pnpm eval:cv --calibrate` overwrites `profile.json` with that generic shape. Likely needs a shared change: an optional `calibrate` hook on `CvGame` that the eval script calls.
- **Board switch reread.** The worker can't tell a detector which board to use (`DetectOptions` is frozen and has no hint), and the editor has no way to rerun a reading against the other board. Likely needs a shared change: an optional hint passed from `detectBoard` through the worker to the detector.

## Progress (session paused 2026-10-25)
Done:
- `packages/cv/src/games/patchwork/find-box-board.ts`: a Patchwork board finder. It builds rough outlines from color segmentation (table colors learned from the photo border by k-means, at two lightness weights) and from S2's `findBoardQuad`. It then moves each side to the outermost nearby straight color edge and keeps the outline whose sides are best covered. Corner error against the labeled corners: 0.6% to 1.4% on 7 of 8 fixtures and 2.8% on `07-gray-dark-wood`. S2's finder alone missed 02 and 06 entirely and was 5% to 11% off on 04 and 07. All six empty references are found correctly (checked by eye on the warped images). About 0.6 to 0.8 s per photo in Node.

Prototype findings (scratch script, not committed):
- **Don't use `normalizeLighting`.** Gray-world white balance pulls the red board to neutral (red references end up with mean a* of about 1), which destroyed separation (15 and 17 errors per board). Raw LAB works.
- Features L, a, b, spreadL and edge density, each scaled by its spread across that board's empty references, compared with the nearest of 12 empty samples (3 references × 4 rotations) at the cell's position. With one threshold per board and the finder's corners: red 4 errors of 324 (98.8%), gray 3 of 324 (99.1%). With labeled corners it's 3 and 3.
- Most errors fall within about 20% of the threshold, so a confidence band around the threshold should flag them. Two don't: `03` 7,1 (covered, very close to empty) and `07` 4,5 (empty, far from the threshold, possibly glare).
- The frame-to-grid inset of 0.0275 lines up with the grid lines on the warped references.
- Board color: the whole-board mean a* is dominated by pieces (red 6 to 9, gray 2 to 5). Read it from the frame band instead (red frame a* about 20 or more, gray about 0).

Next: layout and detector (`index.ts`), board color from the frame, the confidence band and glare flag, calibration storage (see open questions), tests, the web wiring (`detector`, `samples`, `features.photo`), and e2e.

## Decisions

## Shared change requests
