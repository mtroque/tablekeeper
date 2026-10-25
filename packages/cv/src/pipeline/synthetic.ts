import type { ImageInput, Point, Quad } from '@tablekeeper/core';

import { getCv, type Mat } from './opencv';

// Synthetic board photos for tests and generated fixtures: a canonical board image placed on a
// table with rotation, perspective skew, tint, darkening and noise.

/** Deterministic random numbers in [0, 1) (mulberry32). */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type SyntheticPhotoOptions = {
  seed: number;
  width: number;
  height: number;
  /** Board side as a share of the photo's shorter side. */
  boardShare?: number;
  /** Degrees, clockwise. */
  rotation?: number;
  /** 0 to about 0.2: how much one side of the board is shortened, as if photographed at an angle. */
  skew?: number;
  /** Per-channel RGB multipliers for the light's color. */
  tint?: [number, number, number];
  /** Overall brightness multiplier. */
  brightness?: number;
  /** Standard deviation of per-pixel noise, in 0 to 255 levels. */
  noise?: number;
  /** Table color. */
  table?: [number, number, number];
};

export const TINTS = {
  neutral: [1, 1, 1],
  warm: [1.12, 0.98, 0.78],
  cool: [0.82, 0.96, 1.15],
} as const satisfies Record<string, [number, number, number]>;

/**
 * Places an RGB board image (any size) into a photo. Returns RGBA pixels and the board's true
 * corners (TL, TR, BR, BL of the board image) in photo pixels. `board` is not deleted.
 */
export function renderSyntheticPhoto(
  board: Mat,
  opts: SyntheticPhotoOptions,
): { image: ImageInput; corners: Quad } {
  const cv = getCv();
  const random = seededRandom(opts.seed);
  const {
    width,
    height,
    boardShare = 0.65,
    rotation = 0,
    skew = 0,
    tint = TINTS.neutral,
    brightness = 1,
    noise = 4,
    table = [196, 160, 120],
  } = opts;

  const aspect = board.cols / board.rows;
  const side = Math.min(width, height) * boardShare;
  const bw = aspect >= 1 ? side : side * aspect;
  const bh = aspect >= 1 ? side / aspect : side;
  const cx = width / 2 + (random() - 0.5) * (width - bw) * 0.3;
  const cy = height / 2 + (random() - 0.5) * (height - bh) * 0.3;
  const skewSide = Math.floor(random() * 4);
  const base: Point[] = [
    { x: -bw / 2, y: -bh / 2 },
    { x: bw / 2, y: -bh / 2 },
    { x: bw / 2, y: bh / 2 },
    { x: -bw / 2, y: bh / 2 },
  ];
  // Shorten one side: its two corners move toward each other.
  const a = base[skewSide] as Point;
  const b = base[(skewSide + 1) % 4] as Point;
  const shrink = (skew / 2) * Math.hypot(b.x - a.x, b.y - a.y);
  const ux = (b.x - a.x) / Math.hypot(b.x - a.x, b.y - a.y);
  const uy = (b.y - a.y) / Math.hypot(b.x - a.x, b.y - a.y);
  base[skewSide] = { x: a.x + ux * shrink, y: a.y + uy * shrink };
  base[(skewSide + 1) % 4] = { x: b.x - ux * shrink, y: b.y - uy * shrink };
  const theta = (rotation * Math.PI) / 180;
  const placed = base.map((p) => ({
    x: cx + p.x * Math.cos(theta) - p.y * Math.sin(theta) + (random() - 0.5) * 4,
    y: cy + p.x * Math.sin(theta) + p.y * Math.cos(theta) + (random() - 0.5) * 4,
  }));
  const corners = keepInFrame(placed, width, height, 0.04 * Math.min(width, height));

  const background = renderTable(width, height, table, random);

  const src = cv.matFromArray(4, 1, cv.CV_32FC2, [
    0,
    0,
    board.cols,
    0,
    board.cols,
    board.rows,
    0,
    board.rows,
  ]);
  const dst = cv.matFromArray(
    4,
    1,
    cv.CV_32FC2,
    corners.flatMap((p) => [p.x, p.y]),
  );
  const transform = cv.getPerspectiveTransform(src, dst);
  const warped = new cv.Mat();
  cv.warpPerspective(
    board,
    warped,
    transform,
    new cv.Size(width, height),
    cv.INTER_LINEAR,
    cv.BORDER_CONSTANT,
    [0, 0, 0, 0],
  );
  const white = new cv.Mat(board.rows, board.cols, cv.CV_8UC1, [255, 255, 255, 255]);
  const alpha = new cv.Mat();
  cv.warpPerspective(
    white,
    alpha,
    transform,
    new cv.Size(width, height),
    cv.INTER_LINEAR,
    cv.BORDER_CONSTANT,
    [0, 0, 0, 0],
  );
  for (const m of [src, dst, transform, white]) m.delete();

  // Light falls off from a random point, as from a lamp.
  const lx = random() * width;
  const ly = random() * height;
  const reach = Math.hypot(width, height);
  const rgba = new Uint8ClampedArray(width * height * 4);
  const bg = background.data;
  const fg = warped.data;
  const al = alpha.data;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const t = (al[i] as number) / 255;
      const light = brightness * (1.05 - 0.2 * (Math.hypot(x - lx, y - ly) / reach));
      for (let c = 0; c < 3; c++) {
        const value = (bg[i * 3 + c] as number) * (1 - t) + (fg[i * 3 + c] as number) * t;
        rgba[i * 4 + c] = value * (tint[c] as number) * light + gaussian(random) * noise;
      }
      rgba[i * 4 + 3] = 255;
    }
  }
  for (const m of [background, warped, alpha]) m.delete();

  // A touch of blur, as from a phone lens.
  const out = new cv.Mat(height, width, cv.CV_8UC4);
  out.data.set(rgba);
  cv.GaussianBlur(out, out, new cv.Size(3, 3), 0.8);
  const data = new Uint8ClampedArray(out.data);
  out.delete();
  return { image: { data, width, height }, corners };
}

/** Shrinks (about its center) and shifts a quad so it sits inside the photo with a margin. */
function keepInFrame(points: Point[], width: number, height: number, margin: number): Quad {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const scale = Math.min(1, (width - 2 * margin) / (x1 - x0), (height - 2 * margin) / (y1 - y0));
  const mx = (x0 + x1) / 2;
  const my = (y0 + y1) / 2;
  const half = { x: ((x1 - x0) * scale) / 2, y: ((y1 - y0) * scale) / 2 };
  const nx = Math.min(width - margin - half.x, Math.max(margin + half.x, mx));
  const ny = Math.min(height - margin - half.y, Math.max(margin + half.y, my));
  const moved = points.map((p) => ({ x: nx + (p.x - mx) * scale, y: ny + (p.y - my) * scale }));
  return [moved[0], moved[1], moved[2], moved[3]] as Quad;
}

/** A table surface: a base color with soft streaks, like wood grain or cloth. */
function renderTable(
  width: number,
  height: number,
  color: readonly [number, number, number],
  random: () => number,
): Mat {
  const cv = getCv();
  const table = new cv.Mat(height, width, cv.CV_8UC3, [...color, 255]);
  const streaks = 40;
  for (let i = 0; i < streaks; i++) {
    const y = random() * height;
    const shade = (random() - 0.5) * 24;
    cv.rectangle(
      table,
      { x: 0, y },
      { x: width, y: y + 2 + random() * 10 },
      color.map((c) => Math.min(255, Math.max(0, c + shade))).concat(255),
      -1,
    );
  }
  cv.GaussianBlur(table, table, new cv.Size(9, 9), 3);
  return table;
}

function gaussian(random: () => number): number {
  const u = Math.max(1e-9, random());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * random());
}
