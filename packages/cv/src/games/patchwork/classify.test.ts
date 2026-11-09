import { describe, expect, it } from 'vitest';

import { bestThreshold, buildReferences, featureScale } from './calibrate';
import {
  boardColor,
  classifySpaces,
  emptyDistance,
  GLARE_CONFIDENCE,
  isGlare,
  thresholdConfidence,
} from './classify';
import type { BoardSample, CellSample } from './measure';
import type { BoardReferences } from './references';

// Features: L, a, b, iqrL, iqrA, iqrB, gradient.
const emptyAt = (row: number) => [40 + row, 25, 0, 2, 1, 1, 1];
const key = (i: number) => `${Math.floor(i / 9)},${i % 9}`;

/** A reference whose empty spaces darken toward the top, like the printed shadow. */
function reference(name: string, frame: [number, number, number] = [30, 15, 0]) {
  return {
    name,
    frame,
    cells: Array.from({ length: 81 }, (_, i) => emptyAt(Math.floor(i / 9))),
  };
}

const red: BoardReferences = {
  references: [reference('empty-red-1.jpg')],
  scale: [1, 1, 1, 1, 1, 1, 1],
  threshold: 5,
};

const cell = (i: number, features: number[], glare = 0): CellSample => ({
  key: key(i),
  features,
  glare,
});

describe('emptyDistance', () => {
  it('is 0 for a space that matches the reference at its own position', () => {
    expect(emptyDistance(cell(0, emptyAt(0)), 0, 0, [30, 15, 0], red)).toBe(0);
  });

  it("matches the board turned 90°: row 0 col 0's empty look can sit at row 0 col 8", () => {
    // Turned 90°, the reference's (8, 0) lands at the photo's (0, 0).
    expect(emptyDistance(cell(0, emptyAt(8)), 0, 0, [30, 15, 0], red)).toBe(0);
    // A look that no turn puts at (0, 0) is still away from every sample.
    expect(emptyDistance(cell(0, emptyAt(4)), 0, 0, [30, 15, 0], red)).toBeGreaterThan(0);
  });

  it('shifts color by the frame difference, so dimmer light reads the same', () => {
    const dim = emptyAt(0).map((v, k) => (k === 0 ? v - 12 : v));
    expect(emptyDistance(cell(0, dim), 0, 0, [18, 15, 0], red)).toBe(0);
    expect(emptyDistance(cell(0, dim), 0, 0, [30, 15, 0], red)).toBe(12);
  });
});

describe('confidence', () => {
  it('is 0.5 at the threshold and 1 a band away on either side', () => {
    expect(thresholdConfidence(5, 5)).toBe(0.5);
    expect(thresholdConfidence(7.5, 5)).toBe(1);
    expect(thresholdConfidence(5 / 1.5, 5)).toBeCloseTo(1);
    expect(thresholdConfidence(5.2, 5)).toBeLessThan(0.6);
    expect(thresholdConfidence(0, 5)).toBe(1);
  });

  it('caps glare spaces below the review line however far they are', () => {
    const glare = cell(0, [85, 0, 0, 1, 1, 1, 1], 0.9);
    expect(isGlare(glare)).toBe(true);
    const [reading] = classifySpaces({ cells: [glare], frame: [30, 15, 0] }, red);
    expect(reading?.glare).toBe(true);
    expect(reading?.covered).toBe(true);
    expect(reading?.confidence).toBe(GLARE_CONFIDENCE);
  });

  it("doesn't call a textured light piece glare", () => {
    expect(isGlare(cell(0, [80, 0, 0, 25, 3, 3, 7], 0.6))).toBe(false);
    expect(isGlare(cell(0, [80, 0, 0, 2, 1, 1, 1], 0.2))).toBe(false);
  });

  it('reads covered spaces as covered with high confidence', () => {
    const sample: Pick<BoardSample, 'cells' | 'frame'> = {
      frame: [30, 15, 0],
      cells: [cell(0, emptyAt(0)), cell(1, [20, 5, 10, 30, 10, 10, 15])],
    };
    const [empty, covered] = classifySpaces(sample, red);
    expect(empty).toMatchObject({ key: '0,0', covered: false, confidence: 1 });
    expect(covered).toMatchObject({ key: '0,1', covered: true, confidence: 1 });
  });
});

describe('boardColor', () => {
  const calibration = { midpoint: 4, halfGap: 4 };

  it('reads a red frame as red and a neutral one as gray', () => {
    expect(boardColor([30, 15, 0], calibration)).toEqual({ board: 'red', confidence: 1 });
    expect(boardColor([50, -1, 0], calibration)).toEqual({ board: 'gray', confidence: 1 });
  });

  it('is unsure near the midpoint', () => {
    expect(boardColor([40, 5, 0], calibration).confidence).toBeCloseTo(0.625);
  });
});

describe('calibration', () => {
  it('puts the threshold in the middle of the widest error-free gap', () => {
    const samples = [1, 2, 3].map((distance) => ({ distance, covered: false }));
    samples.push(...[12, 15].map((distance) => ({ distance, covered: true })));
    expect(bestThreshold(samples)).toEqual({ threshold: 6, errors: 0 });
  });

  it('keeps errors as few as possible when the classes overlap', () => {
    const samples = [
      { distance: 1, covered: false },
      { distance: 4, covered: true },
      { distance: 5, covered: false },
      { distance: 9, covered: true },
      { distance: 10, covered: true },
    ];
    expect(bestThreshold(samples).errors).toBe(1);
  });

  it('scales features by their spread, never below 0.5', () => {
    expect(
      featureScale([
        [0, 0, 0, 0, 0, 0, 0],
        [2, 0, 0, 0, 0, 0, 0],
      ]),
    ).toEqual([1, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5]);
  });

  it('builds both boards and the frame midpoint from samples', () => {
    const sample = (frame: [number, number, number], features: (i: number) => number[]) =>
      ({
        corners: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 1, y: 1 },
          { x: 0, y: 1 },
        ],
        found: true,
        boardConfidence: 1,
        frame,
        warnings: [],
        cells: Array.from({ length: 81 }, (_, i) => cell(i, features(i))),
      }) satisfies BoardSample;
    const gray = (i: number) => [70 + (i % 3), 0, -3, 2, 1, 1, 1];
    const redEmpty = (i: number) => [40 + (i % 3), 25, 0, 2, 1, 1, 1];
    const grid = Array.from({ length: 81 }, (_, i) => i % 2 === 0);
    const piece = [20, 5, 10, 30, 10, 10, 15];
    const { references, summary } = buildReferences(
      [
        { name: 'empty-red-1.jpg', board: 'red', sample: sample([30, 14, 0], redEmpty) },
        { name: 'empty-gray-1.jpg', board: 'gray', sample: sample([52, 0, -3], gray) },
      ],
      [
        {
          board: 'red',
          grid,
          samples: [sample([30, 12, 0], (i) => (grid[i] ? piece : redEmpty(i)))],
        },
        {
          board: 'gray',
          grid,
          samples: [sample([52, -1, -3], (i) => (grid[i] ? piece : gray(i)))],
        },
      ],
    );
    expect(references.boards.red.references).toHaveLength(1);
    expect(references.boards.gray.threshold).toBeGreaterThan(0);
    // Red frames from 12, gray up to 0.
    expect(references.frameRed).toEqual({ midpoint: 6, halfGap: 6 });
    expect(summary.join('\n')).toContain('0 of 81 measured spaces on the wrong side');
  });
});
