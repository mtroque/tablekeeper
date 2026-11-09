import type { HarmoniesSide, Point, Quad } from '@tablekeeper/core';

import { BOARD_ASPECT, GRID, SPACES } from './layout';

// Plain TypeScript geometry for the flattened board, so a reading with known corners needs no
// opencv (docs/slices/H2-harmonies-detection.md → Decisions).

/** RGB or RGBA pixels, row-major. */
export type Pixels = {
  data: Uint8Array | Uint8ClampedArray;
  width: number;
  height: number;
  channels: 3 | 4;
};

/** Maps a point of the unit square (0,0 TL, 1,0 TR, 1,1 BR, 0,1 BL) onto a quad. */
export type SquareToQuad = (u: number, v: number) => Point;

/** The projective map from the unit square onto `quad` (Heckbert's closed form). */
export function squareToQuad(quad: Quad): SquareToQuad {
  const [p0, p1, p2, p3] = quad;
  const dx1 = p1.x - p2.x;
  const dx2 = p3.x - p2.x;
  const dx3 = p0.x - p1.x + p2.x - p3.x;
  const dy1 = p1.y - p2.y;
  const dy2 = p3.y - p2.y;
  const dy3 = p0.y - p1.y + p2.y - p3.y;
  const det = dx1 * dy2 - dx2 * dy1;
  const g = Math.abs(det) < 1e-12 ? 0 : (dx3 * dy2 - dx2 * dy3) / det;
  const h = Math.abs(det) < 1e-12 ? 0 : (dx1 * dy3 - dx3 * dy1) / det;
  const a = p1.x - p0.x + g * p1.x;
  const b = p3.x - p0.x + h * p3.x;
  const d = p1.y - p0.y + g * p1.y;
  const e = p3.y - p0.y + h * p3.y;
  return (u, v) => {
    const w = g * u + h * v + 1;
    return { x: (a * u + b * v + p0.x) / w, y: (d * u + e * v + p0.y) / w };
  };
}

/** Canonical (flattened) board size for a given width; height follows the board's aspect. */
export function canonicalSize(width: number): { width: number; height: number } {
  return { width, height: Math.round(width * BOARD_ASPECT) };
}

/**
 * The board rectangle flattened to `width` pixels wide: RGB, row-major, sampled bilinearly from
 * the photo.
 */
export function flattenBoard(image: Pixels, corners: Quad, width: number): Pixels {
  const size = canonicalSize(width);
  const map = squareToQuad(corners);
  const out = new Uint8ClampedArray(size.width * size.height * 3);
  for (let y = 0; y < size.height; y++) {
    for (let x = 0; x < size.width; x++) {
      const p = map((x + 0.5) / size.width, (y + 0.5) / size.height);
      sampleBilinear(image, p.x - 0.5, p.y - 0.5, out, (y * size.width + x) * 3);
    }
  }
  return { data: out, width: size.width, height: size.height, channels: 3 };
}

/** Writes the bilinear RGB sample at (x, y) into `out` at `at`; edges are clamped. */
function sampleBilinear(
  image: Pixels,
  x: number,
  y: number,
  out: Uint8ClampedArray,
  at: number,
): void {
  const { data, width, height, channels } = image;
  const cx = Math.min(width - 1, Math.max(0, x));
  const cy = Math.min(height - 1, Math.max(0, y));
  const x0 = Math.floor(cx);
  const y0 = Math.floor(cy);
  const x1 = Math.min(width - 1, x0 + 1);
  const y1 = Math.min(height - 1, y0 + 1);
  const fx = cx - x0;
  const fy = cy - y0;
  const i00 = (y0 * width + x0) * channels;
  const i10 = (y0 * width + x1) * channels;
  const i01 = (y1 * width + x0) * channels;
  const i11 = (y1 * width + x1) * channels;
  for (let c = 0; c < 3; c++) {
    const top = (data[i00 + c] as number) * (1 - fx) + (data[i10 + c] as number) * fx;
    const bottom = (data[i01 + c] as number) * (1 - fx) + (data[i11 + c] as number) * fx;
    out[at + c] = top * (1 - fy) + bottom * fy;
  }
}

export type HexCenter = { key: string; q: number; r: number; x: number; y: number };

/**
 * Centers of a side's spaces in the flattened board, in pixels for a board `width` pixels wide
 * (docs/games/harmonies.md → Board rectangle and grid placement), and the hex size.
 */
export function hexCenters(
  side: HarmoniesSide,
  width: number,
): { centers: HexCenter[]; size: number } {
  const grid = GRID[side];
  const size = grid.size * width;
  const centers = SPACES[side].map(({ q, r, key }) => ({
    key,
    q,
    r,
    x: grid.x0 * width + 1.5 * size * q,
    y: grid.y0 * width + Math.sqrt(3) * size * (r + q / 2),
  }));
  return { centers, size };
}
