import type { Point, Quad } from '@tablekeeper/core';

/**
 * Orders 4 points top-left, top-right, bottom-right, bottom-left: clockwise around their centroid
 * (image y points down), starting from the point nearest the top-left (smallest x + y).
 */
export function orderQuad(points: readonly Point[]): Quad {
  if (points.length !== 4) throw new Error(`orderQuad needs 4 points, got ${points.length}`);
  const cx = points.reduce((sum, p) => sum + p.x, 0) / 4;
  const cy = points.reduce((sum, p) => sum + p.y, 0) / 4;
  const clockwise = [...points].sort(
    (a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx),
  );
  let start = 0;
  clockwise.forEach((p, i) => {
    const best = clockwise[start] as Point;
    if (p.x + p.y < best.x + best.y) start = i;
  });
  const at = (i: number): Point => ({ ...(clockwise[(start + i) % 4] as Point) });
  return [at(0), at(1), at(2), at(3)];
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function scaleQuad(quad: Quad, factor: number): Quad {
  const s = (p: Point): Point => ({ x: p.x * factor, y: p.y * factor });
  return [s(quad[0]), s(quad[1]), s(quad[2]), s(quad[3])];
}

/** Average side lengths of an ordered quad. */
export function quadSize(quad: Quad): { width: number; height: number } {
  const [tl, tr, br, bl] = quad;
  return {
    width: (distance(tl, tr) + distance(bl, br)) / 2,
    height: (distance(tl, bl) + distance(tr, br)) / 2,
  };
}

/** Long side over short side. */
export function quadAspect(quad: Quad): number {
  const { width, height } = quadSize(quad);
  return Math.max(width, height) / Math.max(1e-9, Math.min(width, height));
}

/** A centered quad covering `share` of each image dimension. */
export function centeredQuad(width: number, height: number, share = 0.8): Quad {
  const mx = (width - width * share) / 2;
  const my = (height - height * share) / 2;
  return [
    { x: mx, y: my },
    { x: width - mx, y: my },
    { x: width - mx, y: height - my },
    { x: mx, y: height - my },
  ];
}

/**
 * Corner error as a share of board size: the largest distance between matching corners, over the
 * longer side of the true quad.
 */
export function cornerError(found: Quad, truth: Quad): number {
  const { width, height } = quadSize(truth);
  const worst = Math.max(...found.map((p, i) => distance(p, truth[i] as Point)));
  return worst / Math.max(width, height);
}

/** Polygon area by the shoelace formula (absolute). */
export function polygonArea(points: readonly Point[]): number {
  let sum = 0;
  points.forEach((p, i) => {
    const q = points[(i + 1) % points.length] as Point;
    sum += p.x * q.y - q.x * p.y;
  });
  return Math.abs(sum) / 2;
}

/** Shrinks a polygon toward its centroid, keeping `1 - inset` of its size. */
export function insetPolygon(points: readonly Point[], inset: number): Point[] {
  const cx = points.reduce((sum, p) => sum + p.x, 0) / points.length;
  const cy = points.reduce((sum, p) => sum + p.y, 0) / points.length;
  const keep = 1 - inset;
  return points.map((p) => ({ x: cx + (p.x - cx) * keep, y: cy + (p.y - cy) * keep }));
}

/** Even-odd point-in-polygon test. */
export function pointInPolygon(x: number, y: number, polygon: readonly Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i] as Point;
    const b = polygon[j] as Point;
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

export type Line = { point: Point; direction: Point };

/** Total least squares line through points (direction is the principal axis). */
export function fitLine(points: readonly Point[]): Line | undefined {
  if (points.length < 2) return undefined;
  const n = points.length;
  const mx = points.reduce((sum, p) => sum + p.x, 0) / n;
  const my = points.reduce((sum, p) => sum + p.y, 0) / n;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (const p of points) {
    sxx += (p.x - mx) ** 2;
    syy += (p.y - my) ** 2;
    sxy += (p.x - mx) * (p.y - my);
  }
  const angle = Math.atan2(2 * sxy, sxx - syy) / 2;
  return { point: { x: mx, y: my }, direction: { x: Math.cos(angle), y: Math.sin(angle) } };
}

export function intersectLines(a: Line, b: Line): Point | undefined {
  const cross = a.direction.x * b.direction.y - a.direction.y * b.direction.x;
  if (Math.abs(cross) < 1e-9) return undefined;
  const dx = b.point.x - a.point.x;
  const dy = b.point.y - a.point.y;
  const t = (dx * b.direction.y - dy * b.direction.x) / cross;
  return { x: a.point.x + t * a.direction.x, y: a.point.y + t * a.direction.y };
}

/** Distance from a point to the segment a to b, and how far along it the projection falls (0 to 1). */
export function segmentProjection(p: Point, a: Point, b: Point): { distance: number; t: number } {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const length2 = vx * vx + vy * vy;
  const t = length2 === 0 ? 0 : ((p.x - a.x) * vx + (p.y - a.y) * vy) / length2;
  const px = a.x + t * vx;
  const py = a.y + t * vy;
  return { distance: Math.hypot(p.x - px, p.y - py), t };
}
