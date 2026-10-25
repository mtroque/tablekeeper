import { beforeAll, describe, expect, it } from 'vitest';

import { loadOpenCvInNode } from '../node';

import { findBlobs } from './blobs';
import { sampleCells, squareGridLayout } from './cells';
import { matchTemplateRotInvariant } from './match';
import { getCv, type Mat } from './opencv';

beforeAll(async () => {
  await loadOpenCvInNode();
});

describe('sampleCells', () => {
  it('samples only the inset of each cell', () => {
    const cv = getCv();
    // 2 × 2 cells of 20 px; each cell's 2 px border is black, its inside white.
    const mat = new cv.Mat(40, 40, cv.CV_8UC3, [0, 0, 0, 255]);
    for (const [x, y] of [
      [0, 0],
      [20, 0],
      [0, 20],
      [20, 20],
    ] as const) {
      cv.rectangle(mat, { x: x + 2, y: y + 2 }, { x: x + 17, y: y + 17 }, [255, 255, 255, 255], -1);
    }
    const layout = squareGridLayout({
      rows: 2,
      cols: 2,
      origin: { x: 0, y: 0 },
      cellWidth: 20,
      cellHeight: 20,
    });
    expect(layout.cells.map((c) => c.key)).toEqual(['0,0', '0,1', '1,0', '1,1']);
    const regions = sampleCells(mat, layout, { inset: 0.25 });
    mat.delete();
    for (const region of regions) {
      const inside = [...region.mask].map((m, i) => (m ? region.rgb[i * 3]! : 255));
      expect(Math.min(...inside)).toBe(255);
      expect(region.mask.reduce((a, b) => a + b, 0)).toBeGreaterThan(150);
    }
  });
});

describe('findBlobs', () => {
  it('measures area, circularity and color of separate tokens', () => {
    const cv = getCv();
    const image = new cv.Mat(200, 300, cv.CV_8UC3, [40, 40, 40, 255]);
    const mask = new cv.Mat(200, 300, cv.CV_8UC1, [0, 0, 0, 0]);
    cv.circle(image, { x: 60, y: 100 }, 30, [200, 30, 30, 255], -1);
    cv.circle(mask, { x: 60, y: 100 }, 30, [255, 0, 0, 0], -1);
    cv.rectangle(image, { x: 150, y: 60 }, { x: 250, y: 140 }, [30, 30, 200, 255], -1);
    cv.rectangle(mask, { x: 150, y: 60 }, { x: 250, y: 140 }, [255, 0, 0, 0], -1);
    cv.circle(mask, { x: 280, y: 20 }, 2, [255, 0, 0, 0], -1);

    const blobs = findBlobs(image, mask, { minArea: 50 });
    expect(blobs).toHaveLength(2);
    const [square, circle] = blobs as [(typeof blobs)[0], (typeof blobs)[0]];
    expect(square.area).toBeCloseTo(100 * 80, -2);
    expect(square.circularity).toBeLessThan(0.85);
    expect(square.meanRgb[2]).toBeGreaterThan(190);
    expect(circle.circularity).toBeGreaterThan(0.85);
    expect(circle.centroid.x).toBeCloseTo(60, 0);
    expect(circle.meanRgb[0]).toBeGreaterThan(190);
    expect(findBlobs(image, mask, { minArea: 50, minCircularity: 0.85 })).toHaveLength(1);
    image.delete();
    mask.delete();
  });
});

describe('matchTemplateRotInvariant', () => {
  function token(kind: 'arrow' | 'bar', angle = 0): Mat {
    const cv = getCv();
    const mat = new cv.Mat(64, 64, cv.CV_8UC3, [230, 220, 200, 255]);
    if (kind === 'arrow') {
      cv.rectangle(mat, { x: 28, y: 14 }, { x: 36, y: 50 }, [40, 40, 40, 255], -1);
      cv.rectangle(mat, { x: 36, y: 14 }, { x: 50, y: 22 }, [40, 40, 40, 255], -1);
    } else {
      cv.rectangle(mat, { x: 14, y: 28 }, { x: 50, y: 36 }, [40, 40, 40, 255], -1);
      cv.circle(mat, { x: 20, y: 46 }, 4, [40, 40, 40, 255], -1);
    }
    if (angle === 0) return mat;
    const m = cv.getRotationMatrix2D({ x: 32, y: 32 }, angle, 1);
    const rotated = new cv.Mat();
    cv.warpAffine(mat, rotated, m, { width: 64, height: 64 }, cv.INTER_LINEAR, cv.BORDER_REPLICATE);
    m.delete();
    mat.delete();
    return rotated;
  }

  it('matches a rotated crop to the right reference and recovers the turn', () => {
    const refs = [
      { key: 'arrow', mat: token('arrow') },
      { key: 'bar', mat: token('bar') },
    ];
    const crop = token('arrow', 90);
    const match = matchTemplateRotInvariant(crop, refs);
    expect(match.key).toBe('arrow');
    expect(match.score).toBeGreaterThan(0.8);
    expect(match.angle).toBe(270);
    expect(match.scores.arrow).toBeGreaterThan(match.scores.bar!);
    crop.delete();
    for (const ref of refs) ref.mat.delete();
  });
});
