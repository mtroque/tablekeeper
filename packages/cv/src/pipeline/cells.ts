import type { Point } from '@tablekeeper/core';

import { insetPolygon, pointInPolygon } from './geometry';
import type { Mat } from './opencv';

/** Cell polygons in canonical (warped board) coordinates. */
export type BoardLayout = { cells: Array<{ key: string; polygon: Point[] }> };

/** A cell's inset pixels, copied out of the board image. */
export type CellRegion = {
  key: string;
  width: number;
  height: number;
  /** RGB, row-major, `width * height * 3`. */
  rgb: Uint8ClampedArray;
  /** 1 where the pixel is inside the inset polygon. */
  mask: Uint8Array;
};

/** A rows × cols grid filling the rectangle from `origin`, keys `"row,col"`. */
export function squareGridLayout(opts: {
  rows: number;
  cols: number;
  origin: Point;
  cellWidth: number;
  cellHeight: number;
}): BoardLayout {
  const cells: BoardLayout['cells'] = [];
  for (let row = 0; row < opts.rows; row++) {
    for (let col = 0; col < opts.cols; col++) {
      const x = opts.origin.x + col * opts.cellWidth;
      const y = opts.origin.y + row * opts.cellHeight;
      cells.push({
        key: `${row},${col}`,
        polygon: [
          { x, y },
          { x: x + opts.cellWidth, y },
          { x: x + opts.cellWidth, y: y + opts.cellHeight },
          { x, y: y + opts.cellHeight },
        ],
      });
    }
  }
  return { cells };
}

/**
 * Copies each cell's pixels from an RGB board image, keeping only the polygon shrunk by `inset`
 * (a share of its size) to skip grid lines and neighbors.
 */
export function sampleCells(
  mat: Mat,
  layout: BoardLayout,
  opts: { inset?: number } = {},
): CellRegion[] {
  const inset = opts.inset ?? 0.2;
  const channels = mat.channels();
  const data = mat.data;
  return layout.cells.map(({ key, polygon }) => {
    const shape = insetPolygon(polygon, inset);
    const x0 = clamp(Math.floor(Math.min(...shape.map((p) => p.x))), 0, mat.cols - 1);
    const x1 = clamp(Math.ceil(Math.max(...shape.map((p) => p.x))), x0 + 1, mat.cols);
    const y0 = clamp(Math.floor(Math.min(...shape.map((p) => p.y))), 0, mat.rows - 1);
    const y1 = clamp(Math.ceil(Math.max(...shape.map((p) => p.y))), y0 + 1, mat.rows);
    const width = x1 - x0;
    const height = y1 - y0;
    const rgb = new Uint8ClampedArray(width * height * 3);
    const mask = new Uint8Array(width * height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        const src = ((y0 + y) * mat.cols + (x0 + x)) * channels;
        rgb[i * 3] = data[src] as number;
        rgb[i * 3 + 1] = data[src + 1] as number;
        rgb[i * 3 + 2] = data[src + 2] as number;
        mask[i] = pointInPolygon(x0 + x + 0.5, y0 + y + 0.5, shape) ? 1 : 0;
      }
    }
    return { key, width, height, rgb, mask };
  });
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
