import { describe, expect, it } from 'vitest';

import type { CellRegion } from './cells';
import { cellFeatures, featureVector, rgbToLab } from './features';

function region(
  width: number,
  height: number,
  color: (x: number, y: number) => number[],
): CellRegion {
  const rgb = new Uint8ClampedArray(width * height * 3);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) rgb.set(color(x, y), (y * width + x) * 3);
  }
  return { key: '0,0', width, height, rgb, mask: new Uint8Array(width * height).fill(1) };
}

describe('rgbToLab', () => {
  it('matches reference values', () => {
    const [wl, wa, wb] = rgbToLab(255, 255, 255);
    expect(wl).toBeCloseTo(100, 1);
    expect(wa).toBeCloseTo(0, 1);
    expect(wb).toBeCloseTo(0, 1);
    expect(rgbToLab(0, 0, 0)[0]).toBeCloseTo(0, 5);
    const [rl, ra, rb] = rgbToLab(255, 0, 0);
    expect(rl).toBeCloseTo(53.24, 1);
    expect(ra).toBeCloseTo(80.09, 1);
    expect(rb).toBeCloseTo(67.2, 1);
  });
});

describe('cellFeatures', () => {
  it('a flat region has its color, no spread and no edges', () => {
    const f = cellFeatures(region(10, 10, () => [255, 0, 0]));
    expect(f.lab[0]).toBeCloseTo(53.24, 1);
    expect(f.spread).toEqual([0, 0, 0]);
    expect(f.edgeDensity).toBe(0);
    expect(f.hue).toBeUndefined();
  });

  it('a split region has spread and edges along the split', () => {
    const f = cellFeatures(region(10, 10, (x) => (x < 5 ? [0, 0, 0] : [255, 255, 255])));
    expect(f.lab[0]).toBeCloseTo(50, 0);
    expect(f.spread[0]).toBeCloseTo(50, 0);
    expect(f.edgeDensity).toBeGreaterThan(0.1);
    expect(f.edgeDensity).toBeLessThan(0.3);
  });

  it('ignores pixels outside the mask', () => {
    const r = region(4, 1, (x) => (x === 0 ? [0, 0, 0] : [255, 255, 255]));
    r.mask[0] = 0;
    expect(cellFeatures(r).lab[0]).toBeCloseTo(100, 1);
  });

  it('builds a normalized hue histogram of saturated pixels', () => {
    const f = cellFeatures(
      region(4, 4, (x) => (x < 2 ? [255, 0, 0] : [128, 128, 128])),
      { hueBins: 6 },
    );
    expect(f.hue).toHaveLength(6);
    expect(f.hue!.reduce((a, b) => a + b, 0)).toBeCloseTo(1);
    expect(Math.max(...f.hue!)).toBe(1);
  });

  it('featureVector picks features by name', () => {
    const f = { lab: [1, 2, 3], spread: [4, 5, 6], edgeDensity: 0.07 } as const;
    expect(
      featureVector({ ...f, lab: [...f.lab], spread: [...f.spread] }, ['b', 'spreadL', 'edge']),
    ).toEqual([3, 4, 7.000000000000001]);
  });
});
