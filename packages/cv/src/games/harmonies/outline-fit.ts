import type { Point, Quad } from '@tablekeeper/core';

import { squareToQuad } from './geometry';

// Fits the board's known outline to a photo's edges. The outline is the same on both sides: a
// straight top, straight sides down to about half the board's height, then one wide curve whose
// lowest point is the board rectangle's bottom edge (docs/games/harmonies.md → Board rectangle).
// Each outline point is scored by its distance to the nearest edge pixel whose gradient runs
// the same way as the outline's normal there, so table texture that crosses the outline (wood
// grain along a side edge, say) supports it only where it happens to line up.

/**
 * Gradient direction bins over a full turn; a lookup accepts its own bin and both neighbors.
 * Directions are signed (dark to light), so an outline scored with one polarity is supported only
 * by edges where the board is consistently lighter than the table, or consistently darker.
 */
const BINS = 16;

/**
 * The left half of the outline in board-rectangle units (u across, v down, both 0 to 1), from
 * the top of the left side to the middle of the curve, measured on the dark-table fixtures
 * flattened with their labeled corners. The rounded top corners are left out.
 */
const LEFT_HALF: ReadonlyArray<readonly [number, number]> = [
  [0, 0.05],
  [0, 0.45],
  [0.003, 0.5],
  [0.01, 0.55],
  [0.017, 0.6],
  [0.025, 0.65],
  [0.037, 0.7],
  [0.05, 0.75],
  [0.07, 0.8],
  [0.1, 0.852],
  [0.15, 0.905],
  [0.2, 0.94],
  [0.25, 0.961],
  [0.3, 0.977],
  [0.35, 0.988],
  [0.4, 0.994],
  [0.45, 0.998],
  [0.5, 1],
];

export type OutlinePoint = { u: number; v: number };

/**
 * The outline as a closed path, points about `step` board widths apart: down the left side,
 * along the curve, up the right side, then right to left along the top.
 */
export function outlineModel(step = 0.01, aspect = 0.79): OutlinePoint[] {
  const half: OutlinePoint[] = [];
  for (let i = 0; i + 1 < LEFT_HALF.length; i++) {
    const [u0, v0] = LEFT_HALF[i] as readonly [number, number];
    const [u1, v1] = LEFT_HALF[i + 1] as readonly [number, number];
    const n = Math.max(1, Math.ceil(Math.hypot(u1 - u0, (v1 - v0) * aspect) / step));
    for (let k = 0; k < n; k++) {
      half.push({ u: u0 + ((u1 - u0) * k) / n, v: v0 + ((v1 - v0) * k) / n });
    }
  }
  const right = half.map((p) => ({ u: 1 - p.u, v: p.v })).reverse();
  const top: OutlinePoint[] = [];
  const n = Math.round(0.94 / step);
  for (let k = 0; k <= n; k++) top.push({ u: 0.97 - (0.94 * k) / n, v: 0 });
  return [...half, { u: 0.5, v: 1 }, ...right, ...top];
}

/**
 * Per orientation bin, the distance from each pixel to the nearest edge pixel whose gradient
 * falls in that bin or either neighbor.
 */
export type EdgeField = { width: number; height: number; near: Float32Array[] };

/**
 * Builds the field from a blurred grayscale image and its edge map (non-zero = edge), both
 * `width × height`, one byte per pixel.
 */
export function edgeField(
  gray: Uint8Array,
  edges: Uint8Array,
  width: number,
  height: number,
): EdgeField {
  const dist = Array.from({ length: BINS }, () => new Float32Array(width * height).fill(1e6));
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      if (!edges[i]) continue;
      const g = (dx: number, dy: number) => gray[i + dy * width + dx] as number;
      const gx = g(1, -1) + 2 * g(1, 0) + g(1, 1) - g(-1, -1) - 2 * g(-1, 0) - g(-1, 1);
      const gy = g(-1, 1) + 2 * g(0, 1) + g(1, 1) - g(-1, -1) - 2 * g(0, -1) - g(1, -1);
      if (gx === 0 && gy === 0) continue;
      (dist[orientationBin(Math.atan2(gy, gx))] as Float32Array)[i] = 0;
    }
  }
  for (const map of dist) chamfer(map, width, height);
  const near = dist.map((own, b) => {
    const before = dist[(b + BINS - 1) % BINS] as Float32Array;
    const after = dist[(b + 1) % BINS] as Float32Array;
    const out = new Float32Array(width * height);
    for (let i = 0; i < out.length; i++) {
      out[i] = Math.min(own[i] as number, before[i] as number, after[i] as number);
    }
    return out;
  });
  return { width, height, near };
}

function orientationBin(angle: number): number {
  const turn = 2 * Math.PI;
  const a = ((angle % turn) + turn) % turn;
  return Math.min(BINS - 1, Math.floor((a / turn) * BINS));
}

/** Two-pass chamfer distance transform (steps 1 and √2), in place. */
function chamfer(d: Float32Array, width: number, height: number): void {
  const D = Math.SQRT2;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      let v = d[i] as number;
      if (x > 0) v = Math.min(v, (d[i - 1] as number) + 1);
      if (y > 0) {
        v = Math.min(v, (d[i - width] as number) + 1);
        if (x > 0) v = Math.min(v, (d[i - width - 1] as number) + D);
        if (x < width - 1) v = Math.min(v, (d[i - width + 1] as number) + D);
      }
      d[i] = v;
    }
  }
  for (let y = height - 1; y >= 0; y--) {
    for (let x = width - 1; x >= 0; x--) {
      const i = y * width + x;
      let v = d[i] as number;
      if (x < width - 1) v = Math.min(v, (d[i + 1] as number) + 1);
      if (y < height - 1) {
        v = Math.min(v, (d[i + width] as number) + 1);
        if (x < width - 1) v = Math.min(v, (d[i + width + 1] as number) + D);
        if (x > 0) v = Math.min(v, (d[i + width - 1] as number) + D);
      }
      d[i] = v;
    }
  }
}

/** Mean of `1 - (d / tolerance)²` (floored at 0) over placed points; 1 is a perfect fit. */
function scorePlaced(field: EdgeField, placed: readonly Point[], tolerance: number): number {
  let out = 0;
  let inward = 0;
  const n = placed.length;
  for (let k = 0; k < n; k++) {
    const p = placed[k] as Point;
    const x = Math.round(p.x);
    const y = Math.round(p.y);
    if (x < 0 || y < 0 || x >= field.width || y >= field.height) continue;
    // The outline's normal from its neighbors along the closed path.
    const a = placed[(k + n - 1) % n] as Point;
    const b = placed[(k + 1) % n] as Point;
    // The path runs counterclockwise on screen, so this normal points out of the board.
    const bin = orientationBin(Math.atan2(b.y - a.y, b.x - a.x) + Math.PI / 2);
    const i = y * field.width + x;
    const r = ((field.near[bin] as Float32Array)[i] as number) / tolerance;
    if (r < 1) out += 1 - r * r;
    const s = ((field.near[(bin + BINS / 2) % BINS] as Float32Array)[i] as number) / tolerance;
    if (s < 1) inward += 1 - s * s;
  }
  return Math.max(out, inward) / Math.max(1, n);
}

/**
 * How well the outline placed by `quad` (the board rectangle, TL, TR, BR, BL) lies on edges
 * running the same way, within `tolerance` pixels. 1 is a perfect fit.
 */
export function outlineScore(
  field: EdgeField,
  quad: Quad,
  model: readonly OutlinePoint[],
  tolerance: number,
): number {
  const map = squareToQuad(quad);
  return scorePlaced(
    field,
    model.map((p) => map(p.u, p.v)),
    tolerance,
  );
}

type Move = (quad: Quad, step: number) => Quad;

const shift =
  (dx: number, dy: number): Move =>
  (q, s) =>
    q.map((p) => ({ x: p.x + dx * s, y: p.y + dy * s })) as Quad;

const scale =
  (sign: number): Move =>
  (q, s) => {
    const c = centroid(q);
    const f = 1 + (sign * s) / Math.max(1, topLength(q));
    return q.map((p) => ({ x: c.x + (p.x - c.x) * f, y: c.y + (p.y - c.y) * f })) as Quad;
  };

const rotate =
  (sign: number): Move =>
  (q, s) => {
    const c = centroid(q);
    const t = (sign * s) / Math.max(1, topLength(q));
    const cos = Math.cos(t);
    const sin = Math.sin(t);
    return q.map((p) => ({
      x: c.x + (p.x - c.x) * cos - (p.y - c.y) * sin,
      y: c.y + (p.x - c.x) * sin + (p.y - c.y) * cos,
    })) as Quad;
  };

const corner =
  (index: number, dx: number, dy: number): Move =>
  (q, s) =>
    q.map((p, i) => (i === index ? { x: p.x + dx * s, y: p.y + dy * s } : p)) as Quad;

/** The bottom edge moved along the sides: how far down the curve reaches. */
const depth =
  (sign: number): Move =>
  (q, s) => {
    const [tl, tr, br, bl] = q;
    const along = (top: Point, bottom: Point): Point => {
      const len = Math.max(1e-9, Math.hypot(bottom.x - top.x, bottom.y - top.y));
      return {
        x: bottom.x + ((bottom.x - top.x) / len) * sign * s,
        y: bottom.y + ((bottom.y - top.y) / len) * sign * s,
      };
    };
    return [tl, tr, along(tr, br), along(tl, bl)];
  };

const MOVES: Move[] = [
  shift(1, 0),
  shift(-1, 0),
  shift(0, 1),
  shift(0, -1),
  scale(1),
  scale(-1),
  rotate(1),
  rotate(-1),
  depth(1),
  depth(-1),
  ...[0, 1, 2, 3].flatMap((i) => [
    corner(i, 1, 0),
    corner(i, -1, 0),
    corner(i, 0, 1),
    corner(i, 0, -1),
  ]),
];

/**
 * Moves `start` to fit the outline better, coarse to fine: a pattern search over shifts, scale,
 * rotation, depth and single corners, with a shrinking tolerance. Returns the fitted quad and its
 * score at the finest tolerance (`FINE_TOLERANCE` of the field's longer side).
 */
export function fitOutline(
  field: EdgeField,
  start: Quad,
  model: readonly OutlinePoint[] = outlineModel(),
): { quad: Quad; score: number } {
  let quad = start;
  const span = Math.max(field.width, field.height);
  for (const share of [0.02, 0.01, FINE_TOLERANCE]) {
    const tolerance = Math.max(2, share * span);
    let best = outlineScore(field, quad, model, tolerance);
    let step = tolerance;
    while (step >= 0.5) {
      let improved = false;
      for (const move of MOVES) {
        const next = move(quad, step);
        const score = outlineScore(field, next, model, tolerance);
        if (score > best + 1e-6) {
          best = score;
          quad = next;
          improved = true;
        }
      }
      if (!improved) step /= 2;
    }
  }
  return { quad, score: outlineScore(field, quad, model, Math.max(2, FINE_TOLERANCE * span)) };
}

/** The tolerance a fit is finally scored at, as a share of the photo's longer side. */
export const FINE_TOLERANCE = 0.006;

/**
 * The board rectangle for a pose: `center`, `width`, the board's top edge turned by `angle`
 * (radians, clockwise in image coordinates), height from the board's aspect.
 */
export function poseQuad(center: Point, width: number, angle: number, aspect: number): Quad {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const h = width * aspect;
  const at = (x: number, y: number): Point => ({
    x: center.x + x * cos - y * sin,
    y: center.y + x * sin + y * cos,
  });
  return [
    at(-width / 2, -h / 2),
    at(width / 2, -h / 2),
    at(width / 2, h / 2),
    at(-width / 2, h / 2),
  ];
}

/**
 * Poses most likely to be the board, seen straight down: every center, width and angle on a
 * grid (any of the four quarter turns, up to 18 degrees off), scored with a sparse outline.
 * Returns up to `keep` poses whose corners are far apart, best first.
 */
export function searchOutline(field: EdgeField, aspect: number, opts: SearchOptions = {}): Quad[] {
  const { keep = 10, polishCount = 150 } = opts;
  const { width, height } = field;
  const span = Math.max(width, height);
  const model = outlineModel(0.015, aspect);
  const tolerance = 0.035 * span;
  const step = Math.max(1, Math.round(0.02 * span));
  const n = model.length;
  // Normal bins for the unturned outline; a turn shifts every point's bin the same way.
  const baseAngles = model.map((_, k) => {
    const a = model[(k + n - 1) % n] as OutlinePoint;
    const b = model[(k + 1) % n] as OutlinePoint;
    return Math.atan2((b.v - a.v) * aspect, b.u - a.u) + Math.PI / 2;
  });
  const poses: Array<{ cx: number; cy: number; w: number; angle: number }> = [];
  const scores: number[] = [];
  const offsets = new Int32Array(n);
  const bins = new Int32Array(n);
  for (let quarter = 0; quarter < 4; quarter++) {
    for (let off = -18; off <= 18; off += 3) {
      const angle = (quarter * Math.PI) / 2 + (off * Math.PI) / 180;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      for (let k = 0; k < n; k++) bins[k] = orientationBin((baseAngles[k] as number) + angle);
      for (let w = 0.4 * span; w <= 1.05 * span; w += 0.03 * span) {
        const h = w * aspect;
        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;
        model.forEach((p, k) => {
          const x = (p.u - 0.5) * w;
          const y = (p.v - 0.5) * h;
          const dx = Math.round(x * cos - y * sin);
          const dy = Math.round(x * sin + y * cos);
          offsets[k] = dy * width + dx;
          minX = Math.min(minX, dx);
          maxX = Math.max(maxX, dx);
          minY = Math.min(minY, dy);
          maxY = Math.max(maxY, dy);
        });
        // Centers that keep the whole outline in the photo.
        for (let cy = -minY; cy < height - maxY; cy += step) {
          for (let cx = -minX; cx < width - maxX; cx += step) {
            const center = cy * width + cx;
            let out = 0;
            let inward = 0;
            for (let k = 0; k < n; k++) {
              const at = center + (offsets[k] as number);
              const bin = bins[k] as number;
              const r = ((field.near[bin] as Float32Array)[at] as number) / tolerance;
              if (r < 1) out += 1 - r * r;
              const s =
                ((field.near[(bin + BINS / 2) % BINS] as Float32Array)[at] as number) / tolerance;
              if (s < 1) inward += 1 - s * s;
            }
            poses.push({ cx, cy, w, angle });
            scores.push(Math.max(out, inward) / n);
          }
        }
      }
    }
  }
  // Grid neighbors of a good pose score nearly as well; polish only distinct ones.
  const order = scores
    .map((_, i) => i)
    .sort((a, b) => (scores[b] as number) - (scores[a] as number));
  const distinct: Quad[] = [];
  for (const i of order) {
    const pose = poses[i] as { cx: number; cy: number; w: number; angle: number };
    const quad = poseQuad({ x: pose.cx, y: pose.cy }, pose.w, pose.angle, aspect);
    if (distinct.every((other) => quadDistance(other, quad) > 1.5 * step)) distinct.push(quad);
    if (distinct.length >= polishCount) break;
  }
  // The grid is coarser than the tolerance, so polish each pose a little before ranking.
  const fine = outlineModel(0.02, aspect);
  const polished = distinct.map((quad) => polish(field, quad, fine, 0.02 * span));
  polished.sort((a, b) => b.score - a.score);
  const kept: Quad[] = [];
  for (const { quad } of polished) {
    if (kept.every((other) => quadDistance(other, quad) > 0.06 * span)) kept.push(quad);
    if (kept.length >= keep) break;
  }
  return kept;
}

export type SearchOptions = {
  /** Candidates returned. */
  keep?: number;
  /** Distinct grid poses polished before ranking. */
  polishCount?: number;
};

const SIMILARITY_MOVES = MOVES.slice(0, 8);

/** A short pattern search over shifts, scale and rotation only. */
function polish(
  field: EdgeField,
  start: Quad,
  model: readonly OutlinePoint[],
  tolerance: number,
): { quad: Quad; score: number } {
  let quad = start;
  let best = outlineScore(field, quad, model, tolerance);
  let step = tolerance / 2;
  while (step >= tolerance / 8) {
    let improved = false;
    for (const move of SIMILARITY_MOVES) {
      const next = move(quad, step);
      const score = outlineScore(field, next, model, tolerance);
      if (score > best + 1e-6) {
        best = score;
        quad = next;
        improved = true;
      }
    }
    if (!improved) step /= 2;
  }
  return { quad, score: best };
}

function quadDistance(a: Quad, b: Quad): number {
  return Math.max(...a.map((p, i) => Math.hypot(p.x - (b[i] as Point).x, p.y - (b[i] as Point).y)));
}

function centroid(q: Quad): Point {
  return {
    x: (q[0].x + q[1].x + q[2].x + q[3].x) / 4,
    y: (q[0].y + q[1].y + q[2].y + q[3].y) / 4,
  };
}

function topLength(q: Quad): number {
  return Math.hypot(q[1].x - q[0].x, q[1].y - q[0].y);
}
