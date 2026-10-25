import type { HexCell, HexLayout } from '../../kit/hex-grid';

/** docs/games/harmonies.md → Board layouts. */
export type HarmoniesSide = 'A' | 'B';

export const HARMONIES_SIDES: readonly HarmoniesSide[] = ['A', 'B'];

/** Spaces per column as `[q, first r, last r]`. */
type Columns = ReadonlyArray<readonly [number, number, number]>;

function layoutFrom(columns: Columns): HexLayout {
  const cells: HexCell[] = [];
  for (const [q, from, to] of columns) {
    for (let r = from; r <= to; r++) cells.push({ q, r });
  }
  return { cells };
}

export const HARMONIES_LAYOUTS: Record<HarmoniesSide, HexLayout> = {
  // 5 columns of 5, 4, 5, 4, 5 spaces.
  A: layoutFrom([
    [0, 0, 4],
    [1, 0, 3],
    [2, -1, 3],
    [3, -1, 2],
    [4, -2, 2],
  ]),
  // 7 columns of 4, 3, 4, 3, 4, 3, 4 spaces.
  B: layoutFrom([
    [0, 0, 3],
    [1, 0, 2],
    [2, -1, 2],
    [3, -1, 1],
    [4, -2, 1],
    [5, -2, 0],
    [6, -3, 0],
  ]),
};

/**
 * Where the grid sits in the flattened board rectangle, as fractions of its width
 * (docs/games/harmonies.md → Board rectangle and grid placement).
 */
export const HARMONIES_GRID: Record<HarmoniesSide, { x0: number; y0: number; size: number }> = {
  A: { x0: 0.276, y0: 0.131, size: 0.0735 },
  B: { x0: 0.17, y0: 0.197, size: 0.0739 },
};

/** Board rectangle height over width. */
export const HARMONIES_BOARD_ASPECT = 0.79;
