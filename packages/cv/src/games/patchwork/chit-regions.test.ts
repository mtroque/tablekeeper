import { describe, expect, it } from 'vitest';

import { distanceMap, fillHoles, labelComponents, splitTouching } from './chit-regions';

/** A width × height mask with the pixels where `inside(x, y)` holds. */
function mask(width: number, height: number, inside: (x: number, y: number) => boolean) {
  const out = new Uint8Array(width * height);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) out[y * width + x] = +inside(x, y);
  return out;
}

const disc = (cx: number, cy: number, r: number) => (x: number, y: number) =>
  Math.hypot(x - cx, y - cy) <= r;

/** How many separate parts the split labels hold. */
function parts(labels: Int32Array): number {
  return new Set([...labels].filter((l) => l > 0)).size;
}

describe('chit regions', () => {
  it('fills holes but not bays open to the edge', () => {
    const ring = mask(30, 30, (x, y) => {
      const d = Math.hypot(x - 15, y - 15);
      return d <= 10 && d >= 4;
    });
    const filled = fillHoles(ring, 30, 30);
    expect(filled[15 * 30 + 15]).toBe(1);
    expect(filled[0]).toBe(0);
  });

  it('labels 4-connected components', () => {
    const two = mask(20, 10, (x) => x < 5 || x > 12);
    expect(labelComponents(two, 20).count).toBe(2);
  });

  it('measures the distance to the background', () => {
    const square = mask(21, 21, (x, y) => x > 0 && y > 0 && x < 20 && y < 20);
    const depth = distanceMap(square, 21, 21);
    expect(depth[10 * 21 + 10]).toBeCloseTo(10, 0);
    expect(depth[1 * 21 + 10]).toBeCloseTo(1, 0);
  });

  it('splits two touching discs and marks both parts as split', () => {
    const touching = mask(100, 50, (x, y) => disc(30, 25, 15)(x, y) || disc(59, 25, 15)(x, y));
    const { labels, split } = splitTouching(touching, 100, 50);
    expect(parts(labels)).toBe(2);
    expect(split.size).toBe(2);
  });

  it('keeps a long chit whole', () => {
    // A rounded 10 chit: 30 × 50 with round ends.
    const chit = mask(60, 80, (x, y) => {
      const cy = Math.min(Math.max(y, 30), 50);
      return Math.hypot(x - 30, y - cy) <= 15;
    });
    const { labels, split } = splitTouching(chit, 60, 80);
    expect(parts(labels)).toBe(1);
    expect(split.size).toBe(0);
  });

  it('splits a chit pressed against the larger special tile', () => {
    // A 70 × 54 tile with a 40-wide disc pressed into its side.
    const cluster = mask(
      140,
      80,
      (x, y) => (x >= 10 && x < 80 && y >= 13 && y < 67) || disc(96, 40, 20)(x, y),
    );
    const { labels } = splitTouching(cluster, 140, 80);
    expect(parts(labels)).toBe(2);
  });
});
