# Azul (Master Chocolatier edition)

**Official rulebook:** https://cdn.svc.asmodee.net/production-nextmove/uploads/sites/4/2024/06/EN-Azul-chocolate-rulebook-V2-May27_compressed.pdf

**Page numbers:** printed pages 2 to 6 are PDF pages 1 to 5 (PDF page = printed page - 1); the cover (printed p. 1) is the last PDF page, 6.

## Scope

Tracks one player's board through a game. Only the colored chocolate box side is supported, not the free-placement brown side (the rulebook's Variant play).

## Edition vocabulary

User-facing text uses the edition's terms; code and label fields keep the classic names.

| Classic Azul | Master Chocolatier (rulebook and app) | In code and labels |
|---|---|---|
| Wall | Chocolate box | `wall` |
| Floor line | Foundry line | `floorCount` |
| Wall-tiling | Box confection | |
| First player marker | Starting player marker | |
| Factory displays, pattern lines, score track | Same terms | |

## Wall (chocolate box)

- 5×5 grid, `row` 0-4 top to bottom, `col` 0-4 left to right; flat index `row * 5 + col`.
- Each tile color appears once per row and once per column, in a fixed diagonal pattern printed on the board: row 0 from left to right, and each next row shifts right by one. Read from the empty board (`data/fixtures/azul/references/empty-board.jpg`).
- Tile colors: the rulebook names teal, brown, white and black. It never names the fifth color; the app calls it red.

| Row | Col 0 | Col 1 | Col 2 | Col 3 | Col 4 |
|---|---|---|---|---|---|
| 0 | teal | brown | white | black | red |
| 1 | red | teal | brown | white | black |
| 2 | black | red | teal | brown | white |
| 3 | white | black | red | teal | brown |
| 4 | brown | white | black | red | teal |

How they look: teal is light blue with white stripes, brown is light brown with wavy lines, white is plain cream, black is dark brown with a swirl, red is a glossy raspberry red.

## Board

- **Printed chocolates:** every chocolate box space shows a faint image of the chocolate that goes there, so an empty space looks much like a placed tile. This is why Azul has no photo detection (D-017, `docs/slices/A2-azul-detection.md`).
- **Top marker:** the score track (0 to 100) runs along the top edge, with its "0" box in the top-left corner. Below it, the pattern lines and the AZUL logo are on the left, the chocolate box on the right, and the foundry line runs along the bottom.
- **Placement,** measured on the flattened empty reference, as fractions of the board's width from its top-left outer corner (x right, y down):

| Measure | Value |
|---|---|
| Board height | 1.00 (square) |
| Wall, top-left space centre | (0.556, 0.393) |
| Wall space pitch, both directions | 0.0888 |
| Wall space size | 0.080 |
| Foundry line slot centres | y 0.847; x 0.076, 0.171, 0.266, 0.362, 0.457, 0.552, 0.647 |
| Foundry line slot size | 0.080 |

## Scoring rules

| ID | Rule |
|---|---|
| AZU-PLACE-1 | During box confection, tiles move to the chocolate box row by row from top to bottom; each tile is scored immediately when placed, so later tiles in the same round see earlier ones. |
| AZU-PLACE-2 | A tile with no horizontally or vertically adjacent tiles scores 1. |
| AZU-PLACE-3 | Otherwise: if it has horizontal neighbors, count the unbroken horizontal run including it; if it has vertical neighbors, count the unbroken vertical run including it; score the sum of those counts. |
| AZU-FLOOR-1 | Foundry line penalties by slot: −1, −1, −2, −2, −2, −3, −3 (7 slots; cumulative: 1→−1, 2→−2, 3→−4, 4→−6, 5→−8, 6→−11, 7→−14). |
| AZU-FLOOR-2 | The starting player marker on the foundry line counts as a tile there. |
| AZU-FLOOR-3 | A player's score never drops below 0. |
| AZU-END-1 | +2 per complete horizontal row. |
| AZU-END-2 | +7 per complete vertical column. |
| AZU-END-3 | +10 per color with all 5 tiles in the chocolate box. |
| AZU-END-4 | End bonuses are added once, after the final round. |

## Round model (app-specific)

| ID | Rule |
|---|---|
| AZU-ROUND-1 | A round's new tiles = spaces occupied now but not in the previous confirmed chocolate box. |
| AZU-ROUND-2 | At most one new tile per row per round; more is a validation error shown on the editor. |
| AZU-ROUND-3 | A tile present before but missing now is a validation error (likely an entry mistake), never silently accepted. |
| AZU-ROUND-4 | Round score = sum of placement scores (top row first) + foundry line penalty; running total = max(0, previous total + round score). |

## Worked examples (use as tests)

| Previous chocolate box (occupied) | New tile | Placement score |
|---|---|---|
| none | (2,2) | **1** |
| (0,0), (0,1) | (0,2) | **3** (horizontal run of 3) |
| (0,1), (1,0) | (1,1) | **4** (horizontal 2 + vertical 2) |
| (0,0), (0,1), (1,0) | (1,1) | **4** (horizontal 2 + vertical 2) |

| Round | Placements | Foundry line tiles | Total before | Total after |
|---|---|---|---|---|
| 1 | 1 + 1 | 3 (−4) | 0 | **0** (floored) |
| 2 | 3 + 4 | 1 (−1) | 0 | **6** |

End bonus example: one complete row, no columns, no full colors → **+2**.

## State

`rounds: Array<{ wall: boolean[25], floorCount: 0..7 }>`, `finished: boolean`. Round scores and totals are derived by the scorer, never stored as input.
