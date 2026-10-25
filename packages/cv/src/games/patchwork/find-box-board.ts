import type { Point, Quad } from '@tablekeeper/core';

import { rgbToLab } from '../../pipeline/features';
import { findBoardQuad, matPoints } from '../../pipeline/find-board';
import {
  intersectLines,
  orderQuad,
  polygonArea,
  quadAspect,
  type Line,
} from '../../pipeline/geometry';
import { getCv, type Mat } from '../../pipeline/opencv';

/** Longest side of the copy the board is segmented on. */
const WORK_SIDE = 400;
/** Width of the image border the table colors are sampled from, as a share of the short side. */
const BORDER = 0.03;
const TABLE_CLUSTERS = 4;
/** A table cluster needs this share of the border pixels; smaller ones are the board or chits. */
const MIN_CLUSTER_SHARE = 0.12;

export type BoxBoardQuad = { quad: Quad; confidence: number };

/**
 * Finds the box board. Rough outlines come from color (the table's colors are learned from the
 * photo's border and every pixel far from all of them is board or chits) and from the shared edge
 * finder; each side of each outline is then moved to the strongest straight edge near it, and the
 * outline whose sides are best covered by edges wins. Undefined when nothing square is found.
 */
export function findBoxBoard(mat: Mat): BoxBoardQuad | undefined {
  const edges = labImage(mat, EDGE_SIDE);
  const candidates: Quad[] = [];
  for (const lightness of [0.5, 1]) {
    const { mask, width, height, scale } = boardMask(mat, lightness);
    const found = largestQuad(mask, width, height);
    if (found) candidates.push(scaleQuad(found, 1 / scale));
  }
  const shared = findBoardQuad(mat, { aspect: { min: 1, max: 1.4 }, minAreaRatio: 0.1 });
  if (shared.found) candidates.push(shared.quad);

  let best: BoxBoardQuad | undefined;
  for (const candidate of candidates) {
    const rough = scaleQuad(candidate, edges.scale);
    const refined = refineSides(rough, edges);
    if (!refined) continue;
    const aspect = quadAspect(refined.quad);
    if (aspect > 1.4 || polygonArea(refined.quad) < 0.08 * edges.width * edges.height) continue;
    const confidence = clamp01((refined.coverage - 0.5) / 0.4) * clamp01((1.4 - aspect) / 0.25);
    if (!best || confidence > best.confidence) {
      best = { quad: scaleQuad(refined.quad, 1 / edges.scale), confidence };
    }
  }
  return best;
}

/** Longest side of the copy edges are measured on. */
const EDGE_SIDE = 800;
/** A color step at least this big (LAB distance across 4 pixels) counts as an edge. */
const EDGE_STEP = 7;

type LabImage = { lab: Float32Array; width: number; height: number; scale: number };

function labImage(mat: Mat, side: number): LabImage {
  const cv = getCv();
  const scale = Math.min(1, side / Math.max(mat.cols, mat.rows));
  const small = new cv.Mat();
  cv.resize(
    mat,
    small,
    new cv.Size(Math.round(mat.cols * scale), Math.round(mat.rows * scale)),
    0,
    0,
    cv.INTER_AREA,
  );
  const blurred = new cv.Mat();
  cv.GaussianBlur(small, blurred, new cv.Size(5, 5), 0);
  small.delete();
  const image = { lab: toLab(blurred), width: blurred.cols, height: blurred.rows, scale };
  blurred.delete();
  return image;
}

/**
 * Moves each side to the line near it (shifted up to 6% of the board, turned up to 3 degrees)
 * whose length is most covered by a color step, preferring the outermost of near-equal lines, and
 * intersects the four.
 */
function refineSides(quad: Quad, image: LabImage): { quad: Quad; coverage: number } | undefined {
  const center = {
    x: quad.reduce((sum, p) => sum + p.x, 0) / 4,
    y: quad.reduce((sum, p) => sum + p.y, 0) / 4,
  };
  const size = Math.sqrt(polygonArea(quad));
  const lines: Line[] = [];
  let coverage = 0;
  for (let side = 0; side < 4; side++) {
    const a = quad[side] as Point;
    const b = quad[(side + 1) % 4] as Point;
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    const baseAngle = Math.atan2(b.y - a.y, b.x - a.x);
    // Outward normal: away from the quad's center.
    let normal = { x: -(b.y - a.y) / length, y: (b.x - a.x) / length };
    if ((mid.x - center.x) * normal.x + (mid.y - center.y) * normal.y < 0) {
      normal = { x: -normal.x, y: -normal.y };
    }
    const reach = Math.max(4, Math.round(0.06 * size));
    const tried: Array<{ line: Line; score: number; offset: number }> = [];
    for (let turn = -3; turn <= 3; turn += 0.5) {
      const angle = baseAngle + (turn * Math.PI) / 180;
      const direction = { x: Math.cos(angle), y: Math.sin(angle) };
      for (let offset = -reach; offset <= reach; offset++) {
        const point = { x: mid.x + normal.x * offset, y: mid.y + normal.y * offset };
        const score = edgeCoverage(image, point, direction, length);
        tried.push({ line: { point, direction }, score, offset });
      }
    }
    const top = Math.max(...tried.map((t) => t.score));
    const chosen = tried
      .filter((t) => t.score >= 0.75 * top)
      .reduce((p, q) => (q.offset > p.offset ? q : p));
    lines.push(chosen.line);
    coverage += chosen.score / 4;
  }
  const corners: Point[] = [];
  for (let i = 0; i < 4; i++) {
    const corner = intersectLines(lines[(i + 3) % 4] as Line, lines[i] as Line);
    if (!corner) return undefined;
    corners.push(corner);
  }
  return { quad: orderQuad(corners), coverage };
}

/** Share of the middle 80% of a line where the color steps across it. */
function edgeCoverage(image: LabImage, point: Point, direction: Point, length: number): number {
  const normal = { x: -direction.y, y: direction.x };
  const samples = 60;
  let hits = 0;
  for (let s = 0; s < samples; s++) {
    const t = (s / (samples - 1) - 0.5) * 0.8 * length;
    const x = point.x + direction.x * t;
    const y = point.y + direction.y * t;
    const inner = labAt(image, x - 2 * normal.x, y - 2 * normal.y);
    const outer = labAt(image, x + 2 * normal.x, y + 2 * normal.y);
    if (!inner || !outer) continue;
    const step = Math.hypot(inner[0] - outer[0], inner[1] - outer[1], inner[2] - outer[2]);
    if (step >= EDGE_STEP) hits++;
  }
  return hits / samples;
}

function labAt(image: LabImage, x: number, y: number): [number, number, number] | undefined {
  const ix = Math.round(x);
  const iy = Math.round(y);
  if (ix < 0 || iy < 0 || ix >= image.width || iy >= image.height) return undefined;
  const i = (iy * image.width + ix) * 3;
  return [image.lab[i] as number, image.lab[i + 1] as number, image.lab[i + 2] as number];
}

function scaleQuad(quad: Quad, factor: number): Quad {
  return quad.map((p) => ({ x: p.x * factor, y: p.y * factor })) as unknown as Quad;
}

/** Pixels that aren't table, on a copy scaled by `scale`; `lightness` weighs the L difference. */
export function boardMask(
  mat: Mat,
  lightness = 1,
): {
  mask: Uint8Array;
  width: number;
  height: number;
  scale: number;
} {
  const { lab, width, height, scale } = labImage(mat, WORK_SIDE);
  const tables = tableColors(lab, width, height);
  const distance = new Float32Array(width * height);
  for (let i = 0; i < distance.length; i++) {
    let best = Infinity;
    for (const t of tables) {
      const d = Math.hypot(
        lightness * ((lab[i * 3] as number) - t[0]),
        (lab[i * 3 + 1] as number) - t[1],
        (lab[i * 3 + 2] as number) - t[2],
      );
      if (d < best) best = d;
    }
    distance[i] = best;
  }
  const threshold = Math.min(
    otsu(distance),
    Math.max(6, 1.5 * borderNoise(distance, width, height)),
  );
  let mask: Uint8Array = new Uint8Array(width * height);
  for (let i = 0; i < mask.length; i++) mask[i] = (distance[i] as number) > threshold ? 1 : 0;
  // Close small gaps (glare, grid lines), then open to cut thin bridges to nearby chits.
  const radius = Math.max(2, Math.round(Math.min(width, height) * 0.012));
  mask = erode(dilate(mask, width, height, radius), width, height, radius);
  mask = dilate(erode(mask, width, height, radius * 2), width, height, radius * 2);
  return { mask, width, height, scale };
}

function toLab(mat: Mat): Float32Array {
  const data = mat.data;
  const channels = mat.channels();
  const n = mat.cols * mat.rows;
  const lab = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const [L, a, b] = rgbToLab(
      data[i * channels] as number,
      data[i * channels + 1] as number,
      data[i * channels + 2] as number,
    );
    lab[i * 3] = L;
    lab[i * 3 + 1] = a;
    lab[i * 3 + 2] = b;
  }
  return lab;
}

/** The table's main colors: k-means over the border pixels, keeping clusters big enough to be table. */
function tableColors(
  lab: Float32Array,
  width: number,
  height: number,
): Array<[number, number, number]> {
  const band = Math.max(2, Math.round(Math.min(width, height) * BORDER));
  const samples: Array<[number, number, number]> = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (x >= band && x < width - band && y >= band && y < height - band) continue;
      const i = (y * width + x) * 3;
      samples.push([lab[i] as number, lab[i + 1] as number, lab[i + 2] as number]);
    }
  }
  // Deterministic seeds: spread over the samples sorted by lightness.
  const sorted = [...samples].sort((p, q) => p[0] - q[0]);
  let centers = Array.from({ length: TABLE_CLUSTERS }, (_, k) => {
    const s = sorted[Math.floor(((k + 0.5) / TABLE_CLUSTERS) * sorted.length)] ?? [50, 0, 0];
    return [...s] as [number, number, number];
  });
  let counts = new Array<number>(TABLE_CLUSTERS).fill(0);
  for (let iteration = 0; iteration < 12; iteration++) {
    const sums = centers.map(() => [0, 0, 0]);
    counts = new Array<number>(TABLE_CLUSTERS).fill(0);
    for (const s of samples) {
      const k = nearest(s, centers);
      const sum = sums[k] as number[];
      sum[0] = (sum[0] as number) + s[0];
      sum[1] = (sum[1] as number) + s[1];
      sum[2] = (sum[2] as number) + s[2];
      counts[k] = (counts[k] as number) + 1;
    }
    centers = centers.map((c, k) => {
      const n = counts[k] as number;
      const sum = sums[k] as number[];
      return n ? [(sum[0] as number) / n, (sum[1] as number) / n, (sum[2] as number) / n] : c;
    });
  }
  const kept = centers.filter(
    (_, k) => (counts[k] as number) >= MIN_CLUSTER_SHARE * samples.length,
  );
  return kept.length ? kept : centers;
}

function nearest(p: readonly number[], centers: ReadonlyArray<readonly number[]>): number {
  let best = 0;
  let bestD = Infinity;
  centers.forEach((c, k) => {
    const d =
      ((p[0] as number) - (c[0] as number)) ** 2 +
      ((p[1] as number) - (c[1] as number)) ** 2 +
      ((p[2] as number) - (c[2] as number)) ** 2;
    if (d < bestD) {
      bestD = d;
      best = k;
    }
  });
  return best;
}

/** How far table pixels stray from the table colors: the border's 90th percentile distance. */
function borderNoise(distance: Float32Array, width: number, height: number): number {
  const band = Math.max(2, Math.round(Math.min(width, height) * BORDER));
  const values: number[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (x >= band && x < width - band && y >= band && y < height - band) continue;
      values.push(distance[y * width + x] as number);
    }
  }
  values.sort((a, b) => a - b);
  return values[Math.floor(values.length * 0.9)] ?? 0;
}

/** Otsu's threshold over a float map, in 256 bins up to its maximum. */
function otsu(values: Float32Array): number {
  let max = 0;
  for (const v of values) if (v > max) max = v;
  if (max === 0) return 0;
  const bins = new Array<number>(256).fill(0);
  for (const v of values) {
    const b = Math.min(255, Math.floor((v / max) * 255));
    bins[b] = (bins[b] as number) + 1;
  }
  const total = values.length;
  let sumAll = 0;
  bins.forEach((count, b) => (sumAll += count * b));
  let sumBelow = 0;
  let below = 0;
  let best = 0;
  let bestVariance = -1;
  for (let b = 0; b < 256; b++) {
    below += bins[b] as number;
    if (below === 0 || below === total) continue;
    sumBelow += (bins[b] as number) * b;
    const above = total - below;
    const meanBelow = sumBelow / below;
    const meanAbove = (sumAll - sumBelow) / above;
    const variance = below * above * (meanBelow - meanAbove) ** 2;
    if (variance > bestVariance) {
      bestVariance = variance;
      best = b;
    }
  }
  return ((best + 0.5) / 255) * max;
}

/** Square-kernel dilation of a 0/1 mask, separably. */
function dilate(mask: Uint8Array, width: number, height: number, radius: number): Uint8Array {
  return morph(mask, width, height, radius, 1);
}

function erode(mask: Uint8Array, width: number, height: number, radius: number): Uint8Array {
  return morph(mask, width, height, radius, 0);
}

/** Sets a pixel to `hit` when any pixel within `radius` (square) has `hit`. */
function morph(
  mask: Uint8Array,
  width: number,
  height: number,
  radius: number,
  hit: 0 | 1,
): Uint8Array {
  const pass = (src: Uint8Array, horizontal: boolean): Uint8Array => {
    const out = new Uint8Array(src.length);
    const outer = horizontal ? height : width;
    const inner = horizontal ? width : height;
    for (let o = 0; o < outer; o++) {
      // Running count of `hit` pixels in the window.
      let count = 0;
      const at = (i: number) => (horizontal ? o * width + i : i * width + o);
      for (let i = 0; i < Math.min(inner, radius); i++) if (src[at(i)] === hit) count++;
      for (let i = 0; i < inner; i++) {
        const enter = i + radius;
        const leave = i - radius - 1;
        if (enter < inner && src[at(enter)] === hit) count++;
        if (leave >= 0 && src[at(leave)] === hit) count--;
        out[at(i)] = count > 0 ? hit : 1 - hit;
      }
    }
    return out;
  };
  return pass(pass(mask, true), false);
}

/** The largest region's convex outline, reduced to the 4 corners spanning the most area. */
function largestQuad(mask: Uint8Array, width: number, height: number): Quad | undefined {
  const cv = getCv();
  const binary = cv.matFromArray(
    height,
    width,
    cv.CV_8UC1,
    Array.from(mask, (v) => v * 255),
  );
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  cv.findContours(binary, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_NONE);
  binary.delete();
  hierarchy.delete();
  let bestIndex = -1;
  let bestArea = 0;
  for (let i = 0; i < contours.size(); i++) {
    const contour = contours.get(i);
    const area = cv.contourArea(contour);
    contour.delete();
    if (area > bestArea) {
      bestArea = area;
      bestIndex = i;
    }
  }
  if (bestIndex < 0 || bestArea < 0.08 * width * height) {
    contours.delete();
    return undefined;
  }
  const contour = contours.get(bestIndex);
  contours.delete();
  const hull = new cv.Mat();
  const approx = new cv.Mat();
  try {
    cv.convexHull(contour, hull);
    cv.approxPolyDP(hull, approx, 0.005 * cv.arcLength(hull, true), true);
    const corners = largestInscribedQuad(matPoints(approx));
    return corners ? orderQuad(corners) : undefined;
  } finally {
    contour.delete();
    hull.delete();
    approx.delete();
  }
}

/** The 4 of a convex polygon's vertices that span the largest area. */
function largestInscribedQuad(points: Point[]): Point[] | undefined {
  const n = points.length;
  if (n < 4) return undefined;
  let best: Point[] | undefined;
  let bestArea = 0;
  for (let a = 0; a < n; a++) {
    for (let b = a + 1; b < n; b++) {
      for (let c = b + 1; c < n; c++) {
        for (let d = c + 1; d < n; d++) {
          const quad = [points[a], points[b], points[c], points[d]] as Point[];
          const area = polygonArea(quad);
          if (area > bestArea) {
            bestArea = area;
            best = quad;
          }
        }
      }
    }
  }
  return best;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
