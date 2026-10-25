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
- Frame-to-grid inset: about 0.0275 of the board width on each side (so each space is about 0.105 of the board width), the same on both boards within measurement error. Measured on the empty references in `data/fixtures/patchwork/references/` (individual photos and sides range from 0.02 to 0.033); approximate.

## Board coordinates

- Coordinates follow the photo after warping: row 0 is at the top of the photo. No orientation is detected; it doesn't affect scoring, since only empty spaces count.
- Spaces indexed `row` 0-8 top to bottom, `col` 0-8 left to right; flat index `row * 9 + col`.
- State: `board: 'red' | 'gray'`, `grid: boolean[81]` (true = covered), `tokens: { one: number, five: number, ten: number, twenty: number }`, `specialTile: boolean`. The board doesn't affect the score; it's recorded so history and detection know which board was used.
