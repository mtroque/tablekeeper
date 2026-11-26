import type { ImageInput, PatchworkBoard, Point, Quad } from '@tablekeeper/core';

import { insetPolygon } from '../../pipeline/geometry';

import { CELL_INSET, frameBand, PATCHWORK_LAYOUT, rotatedPositions, ROWS, SIZE } from './board';
import type { PatchworkReferences } from './references';

// The color of the chocolate piece on each space, for drawing the read board (P4). Plain
// TypeScript at known corners, so the review screen runs it on the main thread without opencv
// (D-064); the same layout and frame band as `measure.ts`.
//
// Two samples per space: the middle, as `measure.ts` takes it, which the empty references are
// measured on (so it says whether the space looks empty); and a ring around it, which is what
// shows the piece's own color (a printed praline fills the middle of most spaces).

export type Lab = [number, number, number];

/** Each space's median colors and the frame's, as the photo shows them. */
export type MeasuredColors = {
  /** Median LAB of each space's middle (`CELL_INSET`, as `measure.ts`), row by row. */
  spaces: Lab[];
  /** Median LAB of each space's ring (`RING`), row by row. */
  rings: Lab[];
  /** Median LAB of the frame band, reflections left out. */
  frame: Lab;
};

export type SpaceColor = {
  /** The piece's color (the space's ring) corrected for the photo's light. */
  lab: Lab;
  /** The same as `#rrggbb`. */
  hex: string;
  /**
   * The space's color is close to the board's own empty space at its position (or a rotated
   * one): a covered space like this is likely a misread.
   */
  looksEmpty: boolean;
  /** LAB distance to the nearest empty reference space, light corrected. */
  emptyDistance: number;
};

/**
 * LAB distance from an empty reference space under which a color looks empty. On the 8 labeled
 * fixtures this marks 65 of 82 empty spaces and 14 of 566 covered ones, 11 of those on
 * `06-gray-light-wood-glare` (`piece-colors.test.ts`). Color alone can't do better: white
 * chocolate under glare is as light and gray as the gray board.
 */
export const LOOKS_EMPTY_DISTANCE = 5;

/**
 * The ring a piece's color is read from: between these shares of the space's size, around the
 * printed praline and clear of the grid lines.
 */
export const RING = { outer: 0.85, inner: 0.55 } as const;

/**
 * The photo's brightness is corrected by the square root of the frame's gain, within these
 * bounds: a frame in shadow (a dark board on a white table) would otherwise wash every piece out.
 */
const BRIGHTNESS = { min: 0.5, max: 2 } as const;

/**
 * Spaces and the frame are sampled every this many canonical pixels each way: a quarter of the
 * pixels give the same medians, and keep the reading well under 100ms on the main thread.
 */
const STEP = 2;
/** Frame pixels this light and unsaturated are reflections on its bevel (as in `measure.ts`). */
const FRAME_GLARE_L = 80;
const FRAME_GLARE_CHROMA = 12;

/** RGB or RGBA pixels, row-major. */
type Pixels = Pick<ImageInput, 'data' | 'width' | 'height'>;

/** Measures every space's color and the frame's in a photo at the board's corners. */
export function measureSpaceColors(image: Pixels, corners: Quad): MeasuredColors {
  const map = canonicalToPhoto(corners);
  const channels = image.data.length / (image.width * image.height) >= 4 ? 4 : 3;
  const lab: Lab = [0, 0, 0];
  const rgb: Lab = [0, 0, 0];
  /** The color at a warped-board pixel, rounded to bytes as the warped image would be. */
  const labAt = (x: number, y: number): Lab => {
    const p = map(x + 0.5, y + 0.5);
    sampleBilinear(image, channels, p.x - 0.5, p.y - 0.5, rgb);
    return byteLab(Math.round(rgb[0]), Math.round(rgb[1]), Math.round(rgb[2]), lab);
  };

  const spaces: Lab[] = [];
  const rings: Lab[] = [];
  for (const { polygon } of PATCHWORK_LAYOUT.cells) {
    const middle = bounds(insetPolygon(polygon, CELL_INSET));
    const outer = bounds(insetPolygon(polygon, 1 - RING.outer));
    const inner = bounds(insetPolygon(polygon, 1 - RING.inner));
    const area = (x0: number, x1: number, y0: number, y1: number) => (x1 - x0) * (y1 - y0);
    const middleSamples = new LabSamples(area(middle.x0, middle.x1, middle.y0, middle.y1));
    const ringSamples = new LabSamples(area(outer.x0, outer.x1, outer.y0, outer.y1));
    const inside = (box: typeof middle, x: number, y: number) =>
      x >= box.x0 && x < box.x1 && y >= box.y0 && y < box.y1;
    for (let y = outer.y0; y < outer.y1; y += STEP) {
      for (let x = outer.x0; x < outer.x1; x += STEP) {
        const isMiddle = inside(middle, x, y);
        const isRing = !inside(inner, x, y);
        if (!isMiddle && !isRing) continue;
        labAt(x, y);
        if (isMiddle) middleSamples.push(lab);
        if (isRing) ringSamples.push(lab);
      }
    }
    // The middle reaches past the ring's outer edge only if CELL_INSET drops under 1 - outer.
    for (let y = middle.y0; y < middle.y1; y += STEP) {
      for (let x = middle.x0; x < middle.x1; x += STEP) {
        if (!inside(outer, x, y)) middleSamples.push(labAt(x, y));
      }
    }
    spaces.push(middleSamples.median());
    rings.push(ringSamples.median());
  }

  const bands = frameBand().map(bounds);
  const frameSamples = new LabSamples(
    bands.reduce((sum, { x0, x1, y0, y1 }) => sum + (x1 - x0) * (y1 - y0), 0),
  );
  for (const { x0, x1, y0, y1 } of bands) {
    for (let y = y0; y < y1; y += STEP) {
      for (let x = x0; x < x1; x += STEP) {
        const [L, a, b] = labAt(x, y);
        if (L > FRAME_GLARE_L && Math.hypot(a, b) < FRAME_GLARE_CHROMA) continue;
        frameSamples.push(lab);
      }
    }
  }
  return { spaces, rings, frame: frameSamples.median() };
}

/** LAB samples in typed arrays, so the medians sort natively. */
class LabSamples {
  private readonly channels: [Float32Array, Float32Array, Float32Array];
  private count = 0;
  constructor(capacity: number) {
    this.channels = [
      new Float32Array(capacity),
      new Float32Array(capacity),
      new Float32Array(capacity),
    ];
  }
  push(lab: Lab): void {
    this.channels.forEach((values, k) => {
      values[this.count] = lab[k] as number;
    });
    this.count++;
  }
  /** Per-channel median (0 when there are no samples). */
  median(): Lab {
    return this.channels.map((values) => {
      const used = values.subarray(0, this.count).sort();
      return used.length ? (used[Math.floor(used.length / 2)] as number) : 0;
    }) as Lab;
  }
}

/** sRGB bytes to linear light, by table. */
const LINEAR = Float64Array.from({ length: 256 }, (_, c) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
});

/** `rgbToLab` for byte inputs, by table, written into `out` (no allocation per pixel). */
export function byteLab(r: number, g: number, b: number, out: Lab = [0, 0, 0]): Lab {
  const R = LINEAR[r] as number;
  const G = LINEAR[g] as number;
  const B = LINEAR[b] as number;
  const fx = labF((0.4124564 * R + 0.3575761 * G + 0.1804375 * B) / 0.95047);
  const fy = labF(0.2126729 * R + 0.7151522 * G + 0.072175 * B);
  const fz = labF((0.0193339 * R + 0.119192 * G + 0.9503041 * B) / 1.08883);
  out[0] = 116 * fy - 16;
  out[1] = 500 * (fx - fy);
  out[2] = 200 * (fy - fz);
  return out;
}

function labF(t: number): number {
  return t > 216 / 24389 ? Math.cbrt(t) : (t * 24389) / 27 / 116 + 16 / 116;
}

/**
 * Each piece's color corrected for the light, and whether the space looks like an empty space
 * of `board`.
 *
 * The color is white balanced by the frame: each linear RGB channel is scaled by the board
 * references' frame over this photo's, with the overall brightness gain softened to its square
 * root (`BRIGHTNESS`). The looks-empty check shifts the middle's LAB by the frame difference, as
 * `classify.ts` shifts its color features, and compares it with the references' empty spaces.
 */
export function spaceColors(
  measured: MeasuredColors,
  board: PatchworkBoard,
  references: PatchworkReferences,
): SpaceColor[] {
  const refs = references.boards[board].references;
  const meanFrame = [0, 1, 2].map(
    (k) => refs.reduce((sum, ref) => sum + (ref.frame[k] as number), 0) / refs.length,
  ) as Lab;
  const target = labToLinear(meanFrame);
  const photo = labToLinear(measured.frame);
  const gain = target.map((v, k) => v / Math.max(1e-4, photo[k] as number)) as Lab;
  const overall = (gain[0] + gain[1] + gain[2]) / 3;
  const brightness = Math.min(BRIGHTNESS.max, Math.max(BRIGHTNESS.min, Math.sqrt(overall)));
  const scale = gain.map((g) => (g / overall) * brightness);

  return measured.spaces.map((space, index) => {
    const ring = measured.rings[index] ?? space;
    const linear = labToLinear(ring).map((v, k) => v * (scale[k] as number)) as Lab;
    const hex = linearToHex(linear);
    const lab = byteLab(...hexBytes(hex));
    const row = Math.floor(index / ROWS);
    const col = index % ROWS;
    let nearest = Infinity;
    for (const ref of refs) {
      const shifted = space.map(
        (v, k) => v + (ref.frame[k] as number) - (measured.frame[k] as number),
      );
      for (const [r, c] of rotatedPositions(row, col)) {
        const empty = ref.cells[r * ROWS + c] ?? [];
        nearest = Math.min(
          nearest,
          Math.hypot(
            (shifted[0] as number) - (empty[0] ?? 0),
            (shifted[1] as number) - (empty[1] ?? 0),
            (shifted[2] as number) - (empty[2] ?? 0),
          ),
        );
      }
    }
    return { lab, hex, looksEmpty: nearest < LOOKS_EMPTY_DISTANCE, emptyDistance: nearest };
  });
}

/** Linear sRGB (D65) of a CIELAB color, not clamped. */
export function labToLinear([L, a, b]: Lab): Lab {
  const fy = (L + 16) / 116;
  const fx = fy + a / 500;
  const fz = fy - b / 200;
  const finv = (t: number) => (t ** 3 > 216 / 24389 ? t ** 3 : (116 * t - 16) / (24389 / 27));
  const x = finv(fx) * 0.95047;
  const y = finv(fy);
  const z = finv(fz) * 1.08883;
  return [
    3.2404542 * x - 1.5371385 * y - 0.4985314 * z,
    -0.969266 * x + 1.8760108 * y + 0.041556 * z,
    0.0556434 * x - 0.2040259 * y + 1.0572252 * z,
  ];
}

/** `#rrggbb` for linear sRGB, clamped to the gamut. */
function linearToHex(linear: Lab): string {
  return `#${linear
    .map((c) => {
      const v = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
      const byte = Math.round(Math.min(1, Math.max(0, v)) * 255);
      return byte.toString(16).padStart(2, '0');
    })
    .join('')}`;
}

/** sRGB `#rrggbb` for a CIELAB color (D65), clamped to the gamut. */
export function labToHex(lab: Lab): string {
  return linearToHex(labToLinear(lab));
}

function hexBytes(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
}

/**
 * Maps a point of the warped board (`SIZE` square, as `warpToCanonical` makes it) to the photo:
 * the projective map from the unit square onto the corners (Heckbert's closed form).
 */
export function canonicalToPhoto(quad: Quad): (x: number, y: number) => Point {
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
  return (x, y) => {
    const u = x / SIZE;
    const v = y / SIZE;
    const w = g * u + h * v + 1;
    return { x: (a * u + b * v + p0.x) / w, y: (d * u + e * v + p0.y) / w };
  };
}

/** Writes the bilinear RGB sample at (x, y) into `out`; edges are clamped. */
function sampleBilinear(image: Pixels, channels: number, x: number, y: number, out: Lab): void {
  const { data, width, height } = image;
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
    out[c] = top * (1 - fy) + bottom * fy;
  }
}

/** Integer pixel bounds of a polygon, as `sampleCells` takes them. */
function bounds(polygon: readonly Point[]): { x0: number; x1: number; y0: number; y1: number } {
  const xs = polygon.map((p) => p.x);
  const ys = polygon.map((p) => p.y);
  const x0 = Math.max(0, Math.floor(Math.min(...xs)));
  const y0 = Math.max(0, Math.floor(Math.min(...ys)));
  return {
    x0,
    y0,
    x1: Math.min(SIZE, Math.max(x0 + 1, Math.ceil(Math.max(...xs)))),
    y1: Math.min(SIZE, Math.max(y0 + 1, Math.ceil(Math.max(...ys)))),
  };
}
