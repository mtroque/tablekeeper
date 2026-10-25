import type { Point, Quad } from '@tablekeeper/core';
import { describe, expect, it } from 'vitest';

import {
  centeredQuad,
  cornerError,
  fitLine,
  insetPolygon,
  intersectLines,
  orderQuad,
  pointInPolygon,
  polygonArea,
  quadAspect,
} from './geometry';

const SQUARE: Quad = [
  { x: 10, y: 10 },
  { x: 110, y: 10 },
  { x: 110, y: 110 },
  { x: 10, y: 110 },
];

function rotate(points: readonly Point[], degrees: number, center: Point): Point[] {
  const t = (degrees * Math.PI) / 180;
  return points.map((p) => ({
    x: center.x + (p.x - center.x) * Math.cos(t) - (p.y - center.y) * Math.sin(t),
    y: center.y + (p.x - center.x) * Math.sin(t) + (p.y - center.y) * Math.cos(t),
  }));
}

describe('orderQuad', () => {
  it('orders shuffled points TL, TR, BR, BL', () => {
    const [tl, tr, br, bl] = SQUARE;
    expect(orderQuad([br, tl, bl, tr])).toEqual(SQUARE);
    expect(orderQuad([bl, br, tr, tl])).toEqual(SQUARE);
  });

  it('keeps the same order for a board rotated up to 40°', () => {
    for (const degrees of [-40, -20, 15, 40]) {
      const rotated = rotate(SQUARE, degrees, { x: 60, y: 60 });
      const shuffled = [rotated[2], rotated[0], rotated[3], rotated[1]] as Point[];
      expect(orderQuad(shuffled)).toEqual(rotated);
    }
  });

  it('rejects anything but 4 points', () => {
    expect(() => orderQuad(SQUARE.slice(0, 3))).toThrow();
  });
});

describe('quad measures', () => {
  it('aspect is long side over short side', () => {
    const wide: Quad = [
      { x: 0, y: 0 },
      { x: 200, y: 0 },
      { x: 200, y: 100 },
      { x: 0, y: 100 },
    ];
    expect(quadAspect(wide)).toBeCloseTo(2);
    expect(quadAspect(SQUARE)).toBeCloseTo(1);
  });

  it('corner error is the worst corner over the longer side', () => {
    const moved: Quad = [{ x: 12, y: 10 }, SQUARE[1], SQUARE[2], SQUARE[3]];
    expect(cornerError(moved, SQUARE)).toBeCloseTo(0.02);
    expect(cornerError(SQUARE, SQUARE)).toBe(0);
  });

  it('centered quad covers 80% of each side', () => {
    expect(centeredQuad(100, 50)).toEqual([
      { x: 10, y: 5 },
      { x: 90, y: 5 },
      { x: 90, y: 45 },
      { x: 10, y: 45 },
    ]);
  });

  it('polygon area, inset and point test', () => {
    expect(polygonArea(SQUARE)).toBe(10_000);
    expect(polygonArea(insetPolygon(SQUARE, 0.5))).toBeCloseTo(2_500);
    expect(pointInPolygon(60, 60, SQUARE)).toBe(true);
    expect(pointInPolygon(5, 60, SQUARE)).toBe(false);
  });
});

describe('lines', () => {
  it('fits noisy points and intersects two lines', () => {
    const horizontal = fitLine(
      [0, 10, 20, 30, 40].map((x, i) => ({ x, y: 5 + (i % 2 ? 0.2 : -0.2) })),
    );
    const vertical = fitLine([0, 10, 20, 30].map((y) => ({ x: 25, y })));
    const corner = intersectLines(horizontal!, vertical!);
    expect(corner!.x).toBeCloseTo(25, 5);
    expect(corner!.y).toBeCloseTo(5, 1);
  });

  it('parallel lines do not intersect', () => {
    const a = fitLine([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ]);
    const b = fitLine([
      { x: 0, y: 5 },
      { x: 10, y: 5 },
    ]);
    expect(intersectLines(a!, b!)).toBeUndefined();
  });
});
