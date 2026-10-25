import type { Quad } from '@tablekeeper/core';
import { beforeAll, describe, expect, it } from 'vitest';

import { renderExampleBoard } from '../games/_example/board';
import { loadOpenCvInNode } from '../node';

import { BOARD_NOT_FOUND, findBoardQuad } from './find-board';
import { cornerError } from './geometry';
import { loadImage } from './load-image';
import { getCv } from './opencv';
import { renderSyntheticPhoto, TINTS, type SyntheticPhotoOptions } from './synthetic';

const GRID = [
  [true, false, true],
  [false, true, false],
  [true, true, false],
];

const VARIANTS: Array<[string, Partial<SyntheticPhotoOptions>]> = [
  ['straight', {}],
  ['rotated 20°', { rotation: 20 }],
  ['rotated -30°', { rotation: -30 }],
  ['perspective skewed', { skew: 0.18, rotation: 8 }],
  ['warm tint', { tint: TINTS.warm, rotation: -10 }],
  ['cool tint', { tint: TINTS.cool, skew: 0.1 }],
  ['darkened', { brightness: 0.45, rotation: 15 }],
  ['dark and skewed on a gray table', { brightness: 0.55, skew: 0.15, table: [120, 120, 125] }],
  ['small on a white table', { boardShare: 0.4, table: [235, 233, 228], rotation: 25 }],
  ['noisy', { noise: 12, rotation: -5, skew: 0.08 }],
];

function photo(seed: number, opts: Partial<SyntheticPhotoOptions>) {
  const board = renderExampleBoard(GRID, seed);
  const result = renderSyntheticPhoto(board, { seed, width: 960, height: 720, ...opts });
  board.delete();
  return result;
}

function find(image: { data: Uint8ClampedArray; width: number; height: number }) {
  const loaded = loadImage(image);
  const found = findBoardQuad(loaded.mat, { aspect: { min: 1, max: 1.35 } });
  loaded.mat.delete();
  return found;
}

beforeAll(async () => {
  await loadOpenCvInNode();
});

describe('findBoardQuad', () => {
  it.each(VARIANTS)('recovers corners within 2%% of board size: %s', (_name, opts) => {
    for (const seed of [11, 12, 13]) {
      const { image, corners } = photo(seed, opts);
      const found = find(image);
      expect(found.found).toBe(true);
      expect(cornerError(found.quad, corners)).toBeLessThan(0.02);
      expect(found.confidence).toBeGreaterThan(0.3);
    }
  });

  it('falls back to a centered quad with a warning constant when there is no board', () => {
    const cv = getCv();
    const blank = new cv.Mat(480, 640, cv.CV_8UC3, [180, 150, 120, 255]);
    const found = findBoardQuad(blank, { aspect: { min: 1, max: 1.35 } });
    blank.delete();
    expect(found.found).toBe(false);
    expect(found.confidence).toBe(0);
    const expected: Quad = [
      { x: 64, y: 48 },
      { x: 576, y: 48 },
      { x: 576, y: 432 },
      { x: 64, y: 432 },
    ];
    found.quad.forEach((p, i) => {
      expect(p.x).toBeCloseTo(expected[i]!.x, 6);
      expect(p.y).toBeCloseTo(expected[i]!.y, 6);
    });
    expect(BOARD_NOT_FOUND).toBe("Couldn't find the board edges. Drag the corners into place.");
  });

  it('ignores a quad outside the aspect bounds', () => {
    const { image } = photo(5, {});
    const loaded = loadImage(image);
    const found = findBoardQuad(loaded.mat, { aspect: { min: 1.8, max: 2.2 } });
    loaded.mat.delete();
    expect(found.found).toBe(false);
  });
});
