import type { ImageInput } from '@tablekeeper/core';
import { beforeAll, describe, expect, it } from 'vitest';

import { loadOpenCvInNode } from '../../node';
import { cornerError } from '../../pipeline/geometry';
import { loadImage } from '../../pipeline/load-image';
import { trackMats } from '../../pipeline/mat-tracker';
import { getCv } from '../../pipeline/opencv';

import { findHarmoniesBoard } from './board';
import { outlineModel } from './outline-fit';
import { syntheticBoardPhoto, turnQuarter } from './test-photos';

beforeAll(async () => {
  await loadOpenCvInNode();
});

function find(image: ImageInput) {
  const loaded = loadImage(image);
  try {
    return findHarmoniesBoard(loaded.mat);
  } finally {
    loaded.mat.delete();
  }
}

describe('harmonies board outline', () => {
  it('runs down the left side, along the curve, up the right side and back along the top', () => {
    const model = outlineModel(0.02);
    expect(model[0]).toEqual({ u: 0, v: 0.05 });
    const lowest = model.reduce((a, b) => (b.v > a.v ? b : a));
    expect(lowest).toEqual({ u: 0.5, v: 1 });
    const last = model[model.length - 1];
    expect(last?.v).toBe(0);
    expect(last?.u).toBeCloseTo(0.03);
    // Mirror symmetric.
    for (const p of model) {
      expect(
        model.some((q) => Math.abs(q.u - (1 - p.u)) < 1e-9 && Math.abs(q.v - p.v) < 1e-9),
      ).toBe(true);
    }
  });
});

describe('findHarmoniesBoard', () => {
  it('finds the board rectangle of a synthetic photo taken at an angle', () => {
    const { image, corners } = syntheticBoardPhoto('A', {
      seed: 3,
      width: 960,
      height: 760,
      boardShare: 0.8,
      rotation: 8,
      skew: 0.08,
    });
    const board = find(image);
    expect(board.found).toBe(true);
    expect(board.confidence).toBeGreaterThan(0.5);
    expect(cornerError(board.corners, corners)).toBeLessThan(0.02);
  });

  it("gives the corners in the board's own orientation when the photo is turned", () => {
    const { image, corners } = syntheticBoardPhoto('B', {
      seed: 5,
      width: 900,
      height: 700,
      boardShare: 0.8,
      rotation: -5,
    });
    const turned = turnQuarter(image);
    const truth = corners.map(turned.map) as typeof corners;
    const board = find(turned.image);
    expect(board.found).toBe(true);
    expect(cornerError(board.corners, truth)).toBeLessThan(0.02);
  });

  it('falls back to centered corners when there is no board', () => {
    const blank = { data: new Uint8ClampedArray(400 * 300 * 4).fill(120), width: 400, height: 300 };
    const board = find(blank);
    expect(board.found).toBe(false);
    expect(board.confidence).toBe(0);
    expect(board.corners[0].x).toBeCloseTo(40);
    expect(board.corners[0].y).toBeCloseTo(30);
  });

  it('deletes every Mat it creates', () => {
    const { image } = syntheticBoardPhoto('A', { seed: 9, width: 640, height: 500 });
    const loaded = loadImage(image);
    const tracker = trackMats(getCv());
    try {
      findHarmoniesBoard(loaded.mat);
      expect(tracker.live()).toBe(0);
    } finally {
      tracker.restore();
      loaded.mat.delete();
    }
  });
});
