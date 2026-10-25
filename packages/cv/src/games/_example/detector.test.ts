import type { DetectStage } from '@tablekeeper/core';
import { beforeAll, describe, expect, it } from 'vitest';

import { loadOpenCvInNode } from '../../node';
import { cornerError } from '../../pipeline/geometry';
import { renderSyntheticPhoto, TINTS } from '../../pipeline/synthetic';

import { renderExampleBoard } from './board';

import { cvGame, detector, ExampleLabelSchema } from './index';

const GRID = [
  [false, true, true],
  [true, false, false],
  [false, false, true],
];

beforeAll(async () => {
  await loadOpenCvInNode();
});

function photo(seed: number) {
  const board = renderExampleBoard(GRID, seed);
  const result = renderSyntheticPhoto(board, {
    seed,
    width: 960,
    height: 720,
    rotation: -18,
    skew: 0.12,
    tint: TINTS.warm,
    brightness: 0.7,
  });
  board.delete();
  return result;
}

describe('_example detector', () => {
  it('reads the 3×3 board into a draft with corners and per-space confidence', async () => {
    const { image, corners } = photo(7);
    const stages: DetectStage[] = [];
    const draft = await detector.detect(image, { onProgress: (stage) => stages.push(stage) });
    expect(draft.state).toEqual({ cells: GRID.flat() });
    expect(Object.keys(draft.confidence).sort()).toEqual(
      ['0,0', '0,1', '0,2', '1,0', '1,1', '1,2', '2,0', '2,1', '2,2'].sort(),
    );
    for (const value of Object.values(draft.confidence)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
    expect(cornerError(draft.corners, corners)).toBeLessThan(0.02);
    expect(draft.warnings).toEqual([]);
    expect(stages).toEqual(['finding-board', 'classifying']);
  });

  it('uses given corners without finding the board', async () => {
    const { image, corners } = photo(8);
    const stages: DetectStage[] = [];
    const draft = await detector.detect(image, {
      corners,
      onProgress: (stage) => stages.push(stage),
    });
    expect(stages).toEqual(['classifying']);
    expect(draft.corners).toEqual(corners);
    expect(draft.state).toEqual({ cells: GRID.flat() });
  });

  it('returns a draft with a warning and centered corners when no board is found', async () => {
    const blank = { data: new Uint8ClampedArray(400 * 300 * 4).fill(120), width: 400, height: 300 };
    const draft = await detector.detect(blank);
    expect(draft.warnings).toEqual(["Couldn't find the board edges. Drag the corners into place."]);
    expect(draft.corners[0].x).toBeCloseTo(40);
    expect(draft.corners[0].y).toBeCloseTo(30);
  });

  it('maps fixture labels to cell classes', () => {
    const label = ExampleLabelSchema.parse({ grid: ['#..', '.#.', '..#'] });
    const truth = cvGame.cellTruth(label);
    expect(truth['0,0']).toBe('covered');
    expect(truth['0,1']).toBe('empty');
    expect(Object.keys(truth)).toHaveLength(9);
    expect(ExampleLabelSchema.safeParse({ grid: ['#..', '.#.'] }).success).toBe(false);
  });
});
