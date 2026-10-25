# P2: Patchwork board detection

**Status:** ⬜ stub · **Depends on:** P1, S2

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
