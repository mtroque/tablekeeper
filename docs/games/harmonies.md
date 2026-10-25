# Harmonies

**Official rulebook:** https://cdn.svc.asmodee.net/production-libelludv2/uploads/2026/07/HARMONIES_Rules_EN_compressed-1.pdf

**Page numbers:** the PDF has 7 pages: the cover (printed p. 1), then two-page spreads (printed pp. 2-3 to 10-11), then the player aid (printed p. 12). Printed page N is PDF page floor(N / 2) + 1, so link `#page=` to that.

## Pieces

| Code | Token color | Terrain |
|---|---|---|
| `W` | blue | water |
| `F` | yellow | field |
| `M` | gray | mountain |
| `T` | brown | trunk |
| `L` | green | leaves (tree top) |
| `R` | red | building (roof) |

A stack is listed bottom → top, e.g. `TTL` = tree on two trunks.

## Valid stacks

| ID | Rule |
|---|---|
| HAR-STACK-1 | `W` and `F` are only ever single tokens; nothing is stacked on them. |
| HAR-STACK-2 | `M`, `MM`, `MMM`: mountains are 1-3 gray tokens. |
| HAR-STACK-3 | `L`, `TL`, `TTL`: trees are leaves alone or on 1-2 trunks. `T` and `TT` (trunks without leaves) are valid but score nothing. |
| HAR-STACK-4 | `R` may be placed on one `M`, `T` or `R` (`MR`, `TR`, `RR`); a building is height 2. A lone `R` is valid but is not a building. |
| HAR-STACK-5 | Any other stack is invalid; the editor never offers it. |

Height prompts after photo detection follow from these rules: a top of `W` or `F` never asks; `M` asks 1/2/3; `L` asks 1/2/3; `T` asks 1/2; `R` asks "alone or on M/T/R".

## Scoring rules

| ID | Rule |
|---|---|
| HAR-TREE-1 | Tree points by stack: `L` = 1, `TL` = 3, `TTL` = 7. |
| HAR-MTN-1 | Mountain points by height: 1 = 1, 2 = 3, 3 = 7. |
| HAR-MTN-2 | A mountain scores only if at least one adjacent space is also a mountain (any height). |
| HAR-FIELD-1 | Each connected group of 2 or more field spaces scores 5 (single fields score 0). |
| HAR-BLD-1 | A building scores 5 if the adjacent spaces show at least 3 different top colors (empty spaces don't count). |
| HAR-WATER-A-1 | Side A: a river is a connected group of water spaces. Its length is counted from one end to the other along the shortest path, ends included; a branch off that path doesn't count. So the length is the greatest shortest-path distance between two spaces of the same river, counted in spaces (a single water space has length 1). Only the longest river scores. |
| HAR-WATER-A-2 | Side A river points by length: 1 → 0, 2 → 2, 3 → 5, 4 → 8, 5 → 11, 6 → 15, each space beyond 6 → +4. |
| HAR-WATER-B-1 | Side B: each island scores 5. An island is a connected group of non-water spaces separated from others by water or the board edge. Empty spaces count as land. There is always at least 1 island, even with no water separating anything. |
| HAR-ANIMAL-1 | Animal cards are entered manually as a list of point values; their sum is one category. |
| HAR-SPIRIT-1 | Nature's Spirit cards are optional. Each is scored at the end of the game from the rule on the card; the player enters its points, as a list like animal cards, and their sum is its own category. |
| HAR-TOTAL-1 | Total = trees + mountains + fields + buildings + water + animal cards + Nature's Spirit cards. |

## Board layouts

Transcribed from the empty references `data/fixtures/harmonies/references/side-a.jpg` and `side-b.jpg`; goes into `packages/core/src/games/harmonies/layout.ts`.

### Orientation

- The board's top is the straight edge with four paw-print symbols, each with a small upward triangle. The opposite edge is a continuous curve. Both sides have the same outline.
- Coordinates always follow this orientation, never the photo's.

### Coordinates

- Spaces are flat-topped hexes in columns; every odd column sits half a space lower than its neighbors.
- Axial coordinates `(q, r)`, key `"q,r"`: `q` is the column counted from the left (0 first), and `r = row - floor(q / 2)`, where `row` counts spaces down that column from 0. So `"0,0"` is the top-left space, `r` grows by 1 going down a column, and columns 2 and up start at negative `r`.
- Neighbors of `(q, r)`: `(q+1, r)`, `(q-1, r)`, `(q, r+1)`, `(q, r-1)`, `(q+1, r-1)`, `(q-1, r+1)`.

### Side A: 23 spaces

5 columns of 5, 4, 5, 4, 5 spaces.

```
 (0,0)        (2,-1)        (4,-2)
       (1,0)         (3,-1)
 (0,1)        (2,0)         (4,-1)
       (1,1)         (3,0)
 (0,2)        (2,1)         (4,0)
       (1,2)         (3,1)
 (0,3)        (2,2)         (4,1)
       (1,3)         (3,2)
 (0,4)        (2,3)         (4,2)
```

Spaces: `q = 0`: `r` 0 to 4; `q = 1`: `r` 0 to 3; `q = 2`: `r` -1 to 3; `q = 3`: `r` -1 to 2; `q = 4`: `r` -2 to 2.

### Side B: 25 spaces

7 columns of 4, 3, 4, 3, 4, 3, 4 spaces.

```
 (0,0)       (2,-1)       (4,-2)       (6,-3)
       (1,0)        (3,-1)       (5,-2)
 (0,1)       (2,0)        (4,-1)       (6,-2)
       (1,1)        (3,0)        (5,-1)
 (0,2)       (2,1)        (4,0)        (6,-1)
       (1,2)        (3,1)        (5,0)
 (0,3)       (2,2)        (4,1)        (6,0)
```

Spaces: `q = 0`: `r` 0 to 3; `q = 1`: `r` 0 to 2; `q = 2`: `r` -1 to 2; `q = 3`: `r` -1 to 1; `q = 4`: `r` -2 to 1; `q = 5`: `r` -2 to 0; `q = 6`: `r` -3 to 0.

### Board rectangle and grid placement

- **Board rectangle:** the board's bounding rectangle in its own orientation. The bottom is curved, so only the top corners are real: they are the rectangle's top corners. Its bottom corners are where the side edges, extended straight down, meet a horizontal line through the lowest point of the bottom curve. Height is about 0.79 of the width W.
- **Corners convention:** stored `corners` (in `labels.json` and in detection drafts) are this rectangle's top-left, top-right, bottom-right, bottom-left in the board's own orientation, in original-image pixels, whichever way the board is turned in the photo. The flattened view is this rectangle. To mark it by hand, click the two top corners and the lowest point of the curve; the rectangle is built from them with its sides at right angles to the top edge, then its four corners are dragged until the drawn board outline fits.
- **Grid placement**, as fractions of W measured from the rectangle's top-left corner in the flattened view:

| Side | Center of `(0,0)`, x | Center of `(0,0)`, y | Hex size (center to corner) |
|---|---|---|---|
| A | 0.276 | 0.131 | 0.0735 |
| B | 0.170 | 0.197 | 0.0739 |

- Center of `(q, r)`: x = x0 + 1.5 × size × q, y = y0 + √3 × size × (r + q / 2).
- The printed hexes are about 91% of this pitch, leaving a visible gap between spaces.
- Measured on single reference photos that aren't perfectly straight down, so allow about 2% error; the labeler's fine-tune sliders and H2's calibration absorb it.

### State

`{ side: 'A' | 'B', stacks: Record<string, Piece[]>, animalCards: Array<{ points: number }>, spiritCards?: Array<{ points: number }> }`. Missing key = empty space; every key must be a space in that side's layout.

## Worked examples (use as tests)

| Situation | Expected |
|---|---|
| `TTL` alone | trees 7 |
| `MM` with no mountain neighbors | mountains 0 |
| `MM` next to `M` | mountains 3 + 1 = 4 |
| Two adjacent `F`, plus one separate `F` | fields 5 |
| `MR` touching `W`, `F`, `L` | buildings 5 |
| Side A, water path of 4 | water 8 |
| Side A, the rulebook's p. 8 example: a river of 7 water spaces whose ends are 6 spaces apart along the shortest path, with one space branching off it | water 15 (length 6) |
| Side A, the rulebook's p. 9 example: 7 water spaces in a chain, `(2,-1)`, `(1,0)`, `(1,1)`, `(0,2)`, `(0,3)`, `(1,3)`, `(2,3)` | water 19 (length 7) |
| Side B, no water | water 5 (1 island) |
| Nature's Spirit card worth 14 | Nature's Spirit 14 |
