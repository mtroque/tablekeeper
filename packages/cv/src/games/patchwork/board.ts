import type { Point } from '@tablekeeper/core';

import { squareGridLayout, type BoardLayout } from '../../pipeline/cells';

// The box board after warping (docs/games/patchwork.md → Boards): a square whose outer frame
// surrounds a 9×9 grid of spaces.

/** Side of the warped board in pixels. */
export const SIZE = 450;
/** Frame-to-grid inset, as a share of the board width on each side. */
export const FRAME_INSET = 0.0275;
export const ROWS = 9;
export const CELL = (SIZE * (1 - 2 * FRAME_INSET)) / ROWS;
/** Share of each space skipped at its edges, to stay clear of grid lines and piece borders. */
export const CELL_INSET = 0.3;
/** The board is square; the photo's perspective stretches it a little. */
export const ASPECT = { min: 1, max: 1.4 } as const;

export const PATCHWORK_LAYOUT: BoardLayout = squareGridLayout({
  rows: ROWS,
  cols: ROWS,
  origin: { x: SIZE * FRAME_INSET, y: SIZE * FRAME_INSET },
  cellWidth: CELL,
  cellHeight: CELL,
});

/**
 * The four positions a space would occupy if the board were turned 0°, 90°, 180° and 270°:
 * the printed space seen at (row, col) in the photo is one of these on the board.
 */
export function rotatedPositions(row: number, col: number): Array<[number, number]> {
  const last = ROWS - 1;
  return [
    [row, col],
    [col, last - row],
    [last - row, last - col],
    [last - col, row],
  ];
}

/**
 * The frame band the board color is read from: the middle of each side's frame, clear of the
 * corners (where the photo's edge or a mis-placed corner shows table).
 */
export function frameBand(): Point[][] {
  const outer = SIZE * 0.008;
  const inner = SIZE * (FRAME_INSET - 0.008);
  const from = SIZE * 0.15;
  const to = SIZE * 0.85;
  const rect = (x0: number, y0: number, x1: number, y1: number): Point[] => [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ];
  return [
    rect(from, outer, to, inner),
    rect(SIZE - inner, from, SIZE - outer, to),
    rect(from, SIZE - inner, to, SIZE - outer),
    rect(outer, from, inner, to),
  ];
}
