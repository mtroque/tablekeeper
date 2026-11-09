import type { Point, Quad } from '@tablekeeper/core';

import { findBlobs, type Blob } from '../../pipeline/blobs';
import { rgbToLab } from '../../pipeline/features';
import { pointInPolygon, polygonArea } from '../../pipeline/geometry';
import { getCv, type Mat } from '../../pipeline/opencv';

import { borderNoise, dilate, erode, tableColors, toLab } from './find-box-board';

// Praline chits and the special tile lie on the table beside the box board (docs/games/patchwork.md
// → Photo reading). Everything here works on typed arrays at a fixed working size; only the final
// blob measurement goes through opencv.

/** Longest side of the copy chits are segmented on. */
const WORK_SIDE = 600;
/** A pixel this far (LAB) from every table color is chit, or this many times the table's noise. */
const MIN_STEP = 12;
const NOISE_STEPS = 2.5;
/** A board reaching the photo's edge inflates the noise; chits stand at least this far from the table. */
const MAX_STEP = 20;
/** Color counts double: dark purple chits on a dark table differ from it more in hue than in light. */
const CHROMA_WEIGHT = 2;
/**
 * Shadows: unsaturated pixels a little darker than the table aren't chit. Much darker ones are
 * (the dark purple of the chits' backs and edges).
 */
const SHADOW_CHROMA = 8;
const SHADOW_BELOW_TABLE = 4;
const SHADOW_MIN_SHARE = 0.55;
/** The board quad grown by this share, so its bevel and shadow aren't taken for chits. */
const BOARD_MARGIN = 0.03;
/** Seeds are where the distance map reaches these shares of its region's deepest point, in turn. */
const SEED_DEPTHS = [0.6, 0.75, 0.85, 0.92];
/** A part bulkier than this (area over squared thickness) is more than one chit. */
const MAX_BULK = 7.5;

/** One chit-sized region beside the board, in the image the regions were found on. */
export type ChitRegion = Blob & {
  /** Area over the board's area (or over the image's for references), scale free. */
  relativeArea: number;
  /** Long side over short side of the rotated rectangle. */
  aspect: number;
  /** Area over the rotated rectangle's area: about 0.79 for a disc, near 1 for sharp corners. */
  fill: number;
  /** Mean LAB under the region. */
  lab: [number, number, number];
  /** The rotated rectangle's corners in the input image, long sides vertical. */
  quad: Quad;
  /** True when the region was cut from a larger one of touching chits. */
  split: boolean;
};

export type ChitRegionOptions = {
  /** The box board, whose area the regions are measured against and which is left out. */
  board?: Quad;
  /** Regions smaller than this share of the reference area are noise. */
  minArea?: number;
};

/**
 * Finds the chit-sized regions in an RGB image: pixels far from the table's colors (learned from
 * the photo's border), shadows and the board left out, holes filled, and touching chits split
 * along the narrow necks of the distance map.
 */
export function findChitRegions(mat: Mat, opts: ChitRegionOptions = {}): ChitRegion[] {
  const cv = getCv();
  const scale = Math.min(1, WORK_SIDE / Math.max(mat.cols, mat.rows));
  const width = Math.round(mat.cols * scale);
  const height = Math.round(mat.rows * scale);
  const small = new cv.Mat();
  cv.resize(mat, small, new cv.Size(width, height), 0, 0, cv.INTER_AREA);
  const blurred = new cv.Mat();
  cv.GaussianBlur(small, blurred, new cv.Size(3, 3), 0);
  const lab = toLab(blurred);
  blurred.delete();

  const board = opts.board?.map((p) => ({ x: p.x * scale, y: p.y * scale }));
  const grown = board ? growPolygon(board, BOARD_MARGIN) : undefined;
  const referenceArea = board ? polygonArea(board) : width * height;

  const tables = tableColors(lab, width, height);
  const distance = new Float32Array(width * height);
  const nearestL = new Float32Array(width * height);
  for (let i = 0; i < distance.length; i++) {
    let best = Infinity;
    for (const t of tables) {
      const d = Math.hypot(
        (lab[i * 3] as number) - t[0],
        CHROMA_WEIGHT * ((lab[i * 3 + 1] as number) - t[1]),
        CHROMA_WEIGHT * ((lab[i * 3 + 2] as number) - t[2]),
      );
      if (d < best) {
        best = d;
        nearestL[i] = t[0];
      }
    }
    distance[i] = best;
  }
  const threshold = Math.min(
    MAX_STEP,
    Math.max(MIN_STEP, NOISE_STEPS * borderNoise(distance, width, height)),
  );
  let mask: Uint8Array = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if ((distance[i] as number) <= threshold) continue;
      if (grown && pointInPolygon(x, y, grown)) continue;
      const L = lab[i * 3] as number;
      const chroma = Math.hypot(lab[i * 3 + 1] as number, lab[i * 3 + 2] as number);
      const tableL = nearestL[i] as number;
      const shadow = L < tableL - SHADOW_BELOW_TABLE && L > SHADOW_MIN_SHARE * tableL;
      if (shadow && chroma < SHADOW_CHROMA) continue;
      mask[i] = 1;
    }
  }
  // Close gaps inside chits (printed art near the table's color), then open to drop specks.
  const unit = Math.max(1, Math.round(Math.max(width, height) / 600));
  mask = erode(dilate(mask, width, height, 3 * unit), width, height, 3 * unit);
  mask = dilate(erode(mask, width, height, 2 * unit), width, height, 2 * unit);
  mask = fillHoles(mask, width, height);

  const { labels, split } = splitTouching(mask, width, height);
  const binary = cv.matFromArray(
    height,
    width,
    cv.CV_8UC1,
    Array.from(labels, (v) => (v > 0 ? 255 : 0)),
  );
  const minArea = (opts.minArea ?? 0.002) * referenceArea;
  const blobs = findBlobs(small, binary, { minArea });
  binary.delete();
  small.delete();

  return blobs
    .filter((blob) => !touchesEdge(blob, width, height))
    .map((blob) => {
      const { width: w, height: h } = blob.rotatedRect.size;
      const label = labels[Math.round(blob.centroid.y) * width + Math.round(blob.centroid.x)] ?? 0;
      return {
        ...blob,
        relativeArea: blob.area / referenceArea,
        aspect: Math.max(w, h) / Math.max(1e-6, Math.min(w, h)),
        fill: blob.area / Math.max(1e-6, w * h),
        lab: rgbToLab(...blob.meanRgb),
        quad: uprightQuad(blob, 1 / scale),
        split: split.has(label),
      };
    });
}

/** The polygon scaled about its centroid by 1 + `share`. */
function growPolygon(points: readonly Point[], share: number): Point[] {
  const cx = points.reduce((sum, p) => sum + p.x, 0) / points.length;
  const cy = points.reduce((sum, p) => sum + p.y, 0) / points.length;
  return points.map((p) => ({
    x: cx + (p.x - cx) * (1 + share),
    y: cy + (p.y - cy) * (1 + share),
  }));
}

function touchesEdge(blob: Blob, width: number, height: number): boolean {
  const box = blob.boundingBox;
  return box.x <= 0 || box.y <= 0 || box.x + box.width >= width || box.y + box.height >= height;
}

/**
 * The blob's rotated rectangle as TL, TR, BR, BL with its long sides vertical, scaled by `factor`
 * (back to the input image).
 */
function uprightQuad(blob: Blob, factor: number): Quad {
  const { center, size, angle } = blob.rotatedRect;
  const theta = (angle * Math.PI) / 180;
  let u = { x: Math.cos(theta), y: Math.sin(theta) };
  let v = { x: -Math.sin(theta), y: Math.cos(theta) };
  let across = size.width;
  let along = size.height;
  if (across > along) {
    [u, v] = [v, { x: -u.x, y: -u.y }];
    [across, along] = [along, across];
  }
  const corner = (su: number, sv: number): Point => ({
    x: (center.x + (u.x * su * across) / 2 + (v.x * sv * along) / 2) * factor,
    y: (center.y + (u.y * su * across) / 2 + (v.y * sv * along) / 2) * factor,
  });
  return [corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1)];
}

/** Background pixels not reachable from the image's edge become foreground. */
export function fillHoles(mask: Uint8Array, width: number, height: number): Uint8Array {
  const outside = new Uint8Array(mask.length);
  const queue: number[] = [];
  const push = (i: number) => {
    if (!mask[i] && !outside[i]) {
      outside[i] = 1;
      queue.push(i);
    }
  };
  for (let x = 0; x < width; x++) {
    push(x);
    push((height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    push(y * width);
    push(y * width + width - 1);
  }
  while (queue.length) {
    const i = queue.pop() as number;
    const x = i % width;
    if (x > 0) push(i - 1);
    if (x < width - 1) push(i + 1);
    if (i >= width) push(i - width);
    if (i < mask.length - width) push(i + width);
  }
  return Uint8Array.from(outside, (o) => (o ? 0 : 1));
}

/** 4-connected components of a 0/1 mask; labels start at 1. */
export function labelComponents(
  mask: Uint8Array,
  width: number,
): { labels: Int32Array; count: number } {
  const labels = new Int32Array(mask.length);
  let count = 0;
  const queue: number[] = [];
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || labels[start]) continue;
    count++;
    labels[start] = count;
    queue.push(start);
    while (queue.length) {
      const i = queue.pop() as number;
      const x = i % width;
      for (const j of [x > 0 ? i - 1 : -1, x < width - 1 ? i + 1 : -1, i - width, i + width]) {
        if (j < 0 || j >= mask.length || !mask[j] || labels[j]) continue;
        labels[j] = count;
        queue.push(j);
      }
    }
  }
  return { labels, count };
}

/** Distance to the nearest background pixel, by the 3-4 chamfer, in pixels. */
export function distanceMap(mask: Uint8Array, width: number, height: number): Float32Array {
  const big = 1e9;
  const d = Float32Array.from(mask, (m) => (m ? big : 0));
  const at = (x: number, y: number) =>
    x < 0 || y < 0 || x >= width || y >= height ? 0 : (d[y * width + x] as number);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (!d[i]) continue;
      d[i] = Math.min(
        d[i],
        at(x - 1, y) + 3,
        at(x, y - 1) + 3,
        at(x - 1, y - 1) + 4,
        at(x + 1, y - 1) + 4,
      );
    }
  }
  for (let y = height - 1; y >= 0; y--) {
    for (let x = width - 1; x >= 0; x--) {
      const i = y * width + x;
      if (!d[i]) continue;
      d[i] = Math.min(
        d[i],
        at(x + 1, y) + 3,
        at(x, y + 1) + 3,
        at(x + 1, y + 1) + 4,
        at(x - 1, y + 1) + 4,
      );
    }
  }
  return d.map((v) => v / 3);
}

/**
 * Splits regions of touching chits. In each region, the parts of the distance map at least a
 * share of its deepest point are seeds (one per chit, since chits meet at narrower necks), and
 * every pixel joins its nearest seed. The share starts at the first of `SEED_DEPTHS` and goes
 * deeper while a part is still too big for its thickness to be one chit (`MAX_BULK`). Pixels
 * between two parts are cleared so they come apart as separate blobs. Returns the new labels and
 * which ones came from a split.
 */
export function splitTouching(
  mask: Uint8Array,
  width: number,
  height: number,
): { labels: Int32Array; split: Set<number> } {
  const { labels: regions, count } = labelComponents(mask, width);
  const depth = distanceMap(mask, width, height);
  const pixels: number[][] = Array.from({ length: count + 1 }, () => []);
  for (let i = 0; i < mask.length; i++) {
    const r = regions[i] as number;
    if (r) (pixels[r] as number[]).push(i);
  }

  const labels = new Int32Array(mask.length);
  const split = new Set<number>();
  let next = 1;
  for (let r = 1; r <= count; r++) {
    const own = pixels[r] as number[];
    let deepest = 0;
    for (const i of own) deepest = Math.max(deepest, depth[i] as number);
    // The shallowest level whose parts all look like one chit, else the one with the least bulky.
    let parts: Map<number, number[]> = new Map([[0, own]]);
    let worst = Infinity;
    for (const share of SEED_DEPTHS) {
      const tried = growSeeds(own, regions, r, depth, share * deepest, width);
      const bulkiest = Math.max(...[...tried.values()].map((part) => bulk(part, depth)));
      if (bulkiest < worst) {
        parts = tried;
        worst = bulkiest;
      }
      if (bulkiest <= MAX_BULK) break;
    }
    for (const part of parts.values()) {
      for (const i of part) labels[i] = next;
      if (parts.size > 1) split.add(next);
      next++;
    }
  }

  // Clear the boundary between parts (pixels with a 4-neighbor in another part).
  const out = labels.slice();
  for (let i = 0; i < mask.length; i++) {
    const l = labels[i] as number;
    if (!l || !split.has(l)) continue;
    for (const j of neighbors(i, width, mask.length)) {
      if (labels[j] && labels[j] !== l) {
        out[i] = 0;
        break;
      }
    }
  }
  return { labels: out, split };
}

/** Seeds of the region where depth reaches `level`, grown breadth first through the region. */
function growSeeds(
  own: number[],
  regions: Int32Array,
  region: number,
  depth: Float32Array,
  level: number,
  width: number,
): Map<number, number[]> {
  const owner = new Map<number, number>();
  let seedCount = 0;
  // Label the seeds (4-connected pixels at or above the level).
  for (const start of own) {
    if ((depth[start] as number) < level || owner.has(start)) continue;
    seedCount++;
    owner.set(start, seedCount);
    const stack = [start];
    while (stack.length) {
      const i = stack.pop() as number;
      for (const j of neighbors(i, width, regions.length)) {
        if (regions[j] !== region || owner.has(j) || (depth[j] as number) < level) continue;
        owner.set(j, seedCount);
        stack.push(j);
      }
    }
  }
  let frontier = [...owner.keys()];
  while (frontier.length) {
    const grown: number[] = [];
    for (const i of frontier) {
      for (const j of neighbors(i, width, regions.length)) {
        if (regions[j] !== region || owner.has(j)) continue;
        owner.set(j, owner.get(i) as number);
        grown.push(j);
      }
    }
    frontier = grown;
  }
  const parts = new Map<number, number[]>();
  for (const [i, seed] of owner) {
    const part = parts.get(seed) ?? [];
    part.push(i);
    parts.set(seed, part);
  }
  return parts;
}

/**
 * Area over the squared depth of the deepest point: about 3 for a disc, 5 to 6 for a 5 chit, a
 * 10 chit or the special tile, and more for two chits run together.
 */
function bulk(part: number[], depth: Float32Array): number {
  let deepest = 0;
  for (const i of part) deepest = Math.max(deepest, depth[i] as number);
  return deepest > 0 ? part.length / deepest ** 2 : 0;
}

function neighbors(i: number, width: number, length: number): number[] {
  const x = i % width;
  const out: number[] = [];
  if (x > 0) out.push(i - 1);
  if (x < width - 1) out.push(i + 1);
  if (i >= width) out.push(i - width);
  if (i + width < length) out.push(i + width);
  return out;
}
