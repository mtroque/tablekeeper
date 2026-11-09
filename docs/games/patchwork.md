# Patchwork (Valentine's Day edition)

**Official rulebook:** https://www.lookout-spiele.de/upload/en_patchworkvalentine.html_PW_Valentine_Regeln_EN_web.pdf

**Page numbers:** none are printed. The PDF is the two sides of one folded sheet: PDF page 1 has Setup, Playing the Game and actions A and B; PDF page 2 has the time board, the special tile, End of the Game, Scoring, Components and the cover. Cite PDF pages 1 and 2.

## Edition vocabulary

The app uses the rulebook's words in every user-facing text.

| Classic Patchwork | Valentine's Day edition (rulebook and app) |
|---|---|
| Quilt board (9×9) | Box board |
| Squares | Spaces |
| Patches | Chocolate pieces |
| Buttons (currency) | Pralines, paid and held as praline chits |
| Button symbols on patches | Praline symbols |
| Leather patches (1×1) | Petits fours (fill a single space) |
| 7×7 bonus tile | Special tile |
| Time board | Time board |
| Time tokens | Heart tokens |
| Button income on the time board | Praline symbols on the time board |
| Price label (buttons and time) | Banderole |
| Advance and receive buttons | Action A: Advance and Collect Pralines |
| Take and place a patch | Action B: Take and Place a Piece |

## Scoring rules

| ID | Rule |
|---|---|
| PAT-SCORE-1 | Final score = pralines held + 7 if the player holds the special tile − 2 × empty spaces on the box board. |
| PAT-SCORE-2 | A space is empty if no chocolate piece or petit four covers it. A petit four covers exactly one space. |
| PAT-SCORE-3 | The special tile is worth 7. Only one player per game can hold it (the first to completely fill a 7×7 square of spaces). The app does not verify the 7×7 square; the player confirms whether they hold the tile. |
| PAT-SCORE-4 | Praline chits come in values 1, 5, 10 and 20 (32×1, 12×5, 5×10, 1×20). Pralines held = 1 × ones + 5 × fives + 10 × tens + 20 × twenties. |
| PAT-SCORE-5 | Scores can be negative. |

## Worked examples (use as tests)

| Grid | Chits (1/5/10/20) | Special tile | Expected |
|---|---|---|---|
| 6 empty | 6 / 3 / 2 / 0 | yes | 41 + 7 − 12 = **36** |
| 6 empty | 6 / 3 / 2 / 1 | yes | 61 + 7 − 12 = **56** |
| 5 empty | 4 / 0 / 1 / 0 | yes | 14 + 7 − 10 = **11** (the rulebook's Scoring example) |
| 0 empty | 0 / 0 / 0 / 0 | yes | **7** |
| 81 empty | 5 / 0 / 0 / 0 | no | 5 − 162 = **−157** |

## Boards

- Two box boards, red and gray. Both are 9×9 with identical scoring, and both are glossy with a beveled outer frame around the playing grid.
- The boards aren't uniform: a printed shadow darkens the top row and left column, and the red board also darkens toward the bottom right, so empty spaces look different depending on position.
- Frame-to-grid inset: 0.0275 of the board width on each side (so each space is about 0.105 of the board width), the same on both boards within measurement error. Measured on the empty references in `data/fixtures/patchwork/references/` (individual photos and sides range from 0.02 to 0.033) and confirmed on the fixtures: warped at their labeled corners, the grid drawn at 0.0275 falls on the printed grid lines (checked by eye on `02-red-wood-table` and `06-gray-light-wood-glare`), and every space of all 8 fixtures reads correctly with it.
- Chocolate pieces don't sit exactly on the printed grid, and their banderoles and shadows reach into neighboring spaces. Empty spaces also have a printed shading boundary inside some of them.

## Board coordinates

- Coordinates follow the photo after warping: row 0 is at the top of the photo. No orientation is detected; it doesn't affect scoring, since only empty spaces count.
- Spaces indexed `row` 0-8 top to bottom, `col` 0-8 left to right; flat index `row * 9 + col`.
- State: `board: 'red' | 'gray'`, `grid: boolean[81]` (true = covered), `tokens: { one: number, five: number, ten: number, twenty: number }`, `specialTile: boolean`. The board doesn't affect the score; it's recorded so history and detection know which board was used.

## Photo reading

The detector in `packages/cv/src/games/patchwork/` reads the board color, the 81 spaces, and the praline chits and special tile beside the board.

- **Finding the board** (`find-box-board.ts`): rough outlines come from color segmentation (table colors learned from the photo's border by k-means, at two lightness weights) and from the shared `findBoardQuad`. Each side is moved to the outermost nearby straight color edge, and the outline whose sides are best covered wins. No outline: the shared centered fallback and its warning.
- **Layout** (`board.ts`): warped to 450×450; 81 spaces inside the frame at the inset under Boards; each space sampled in its middle 40% (`CELL_INSET` 0.3).
- **Measuring a space** (`measure.ts`): median L, a*, b*, the interquartile range of each, and the 75th percentile of the lightness gradient. Medians and ranges rather than means and standard deviations, because pieces don't sit on the grid and a neighbor's banderole or shadow often reaches into a space (means and edge density at a 20% inset made 7 errors on red and 2 on gray). Raw LAB, not `normalizeLighting`: gray-world white balance pulls the red board to neutral (D-067).
- **Empty or covered** (`classify.ts`): each space's distance to the nearest of 12 empty samples (3 references × its own position and the three rotated ones, D-016), in units of each feature's spread across that board's references. The color features are first shifted by the difference between the reference's frame and this photo's frame, which compensates for the light. Covered when the distance is over the board's threshold; confidence is 0.5 at the threshold and 1 at 1.5 times (or a 1.5th of) it, on a log scale.
- **Board color**: from the frame's a*, not the whole board, which the pieces dominate. Measured: gray frames -2.6 to 0, red 7.2 to 18.4. Confidence 0.5 at the calibrated midpoint, 1 at half the gap from it. A reread with `hints.board` (the board switch) reports confidence 1.
- **Glare**: a pixel is a candidate when it's unsaturated (chroma under 12) and at least 28 lighter than the frame. A space is glare when 40% of its pixels are candidates and it's smooth (lightness IQR under 8, gradient under 5); lightness alone flagged white chocolate and gold praline spaces. A glare space's confidence is capped at 0.4, and capture warns "N spaces have glare. Check them, or retake the photo away from overhead light."
- **Chit regions** (`chit-regions.ts`): on the loaded photo scaled to 600px, pixels far from the table's colors (the board finder's border k-means; LAB distance with a* and b* weighted double, over 12 or 2.5 times the border's noise, capped at 20), leaving out the board quad grown 3% and light shadows (unsaturated, 4 or more darker than the table but over 0.55 of its lightness). Gaps are closed (radius 3), specks opened (radius 2), holes filled. Touching chits are split on the distance map: seeds where it reaches 0.6 of the region's deepest point, then 0.75, 0.85 and 0.92 while a part's area over its squared depth is over 7.5 (a disc is about 3, a chit or the special tile 5 to 6). Regions touching the photo's edge are dropped.
- **Chit classes** (`chits.ts`, PAT-SCORE-4): a region with b* over 12 is gold, so 1 chits, counted as its area over the median lone 1 chit (0.0047 of the board's area if none), so touching 1s that didn't split still count. A purple region is cropped upright (long side vertical, 40×48) and matched with `matchTemplateRotInvariant` (90° steps) against `chits.json`: two crops each of the 5, 10 and 20 chits and of the special tile. Only the special tile is a candidate from 0.03 of the board's area (measured 0.040 to 0.047), only chits from 0.009 to 0.03 (0.012 to 0.022); over 0.06 is unread. Shape adds or takes 0.15: a 5 chit is about 1.2 long over wide, a 10 chit 1.45 to 1.7, a 20 chit 1.1 (from the reference crops; no fixture shows one). A best template score under 0.35 is unread.
- **Chit confidence**, per count and for the special tile: a chit is 0.5 at an even score with the runner-up and 1 at a 0.15 lead, capped at 0.5 when it fills under 0.72 of its rectangle or its template score is under 0.5, and lowers both its count and the runner-up's; touching 1s are 1 within 0.15 of a whole number of chits and 0.5 at 0.3 off. An unread region lowers every count and the special tile to 0.3, with the warning "Some praline chits are touching or hidden. Check the counts, or spread them out and retake the photo." More chits than the box holds, or two special tiles, is 0.3 too. Fixtures where chits overlap (03, 06) are flagged this way.
- **Calibration** (`references.json`, D-068): the 6 empty references measured where the finder puts them; per board, the feature spreads and the threshold in the middle of the widest gap between the labeled fixtures' empty and covered spaces (measured at labeled and at found corners); the frame's a* midpoint. Rebuilt by `pnpm eval:cv patchwork --calibrate`, which also rebuilds `chits.json` from the chit reference crops (each the largest region of its photo, cropped upright), or keeps it when there are none.
- **Eval**: `read` adds a `board` pseudo-cell, `tokens.one` to `tokens.twenty` labeled with the count, and `specialTile` (`yes` or `no`), so the eval counts 87 values per photo (D-068).
- **Samples**: fixtures 02 (`red-board.jpg`), 06 (`gray-board.jpg`, with glare and a 1 chit lying on a 10 chit) and 01 (`red-board-special-tile.jpg`, every chit read), downscaled to 1200px.
