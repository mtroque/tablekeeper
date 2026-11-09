import { describe, expect, it } from 'vitest';

import { CELL, FRAME_INSET, PATCHWORK_LAYOUT, rotatedPositions, SIZE } from './board';

describe('box board layout', () => {
  it('has 81 spaces inside the frame, keyed row,col', () => {
    expect(PATCHWORK_LAYOUT.cells).toHaveLength(81);
    expect(PATCHWORK_LAYOUT.cells[0]?.key).toBe('0,0');
    expect(PATCHWORK_LAYOUT.cells[80]?.key).toBe('8,8');
    const last = PATCHWORK_LAYOUT.cells[80]?.polygon[2];
    expect(last?.x).toBeCloseTo(SIZE * (1 - FRAME_INSET));
    expect(last?.y).toBeCloseTo(SIZE * (1 - FRAME_INSET));
    expect(CELL / SIZE).toBeCloseTo(0.105, 3);
  });

  it('maps a space to its 4 positions under rotation, which cycle back', () => {
    expect(rotatedPositions(0, 0)).toEqual([
      [0, 0],
      [0, 8],
      [8, 8],
      [8, 0],
    ]);
    expect(rotatedPositions(2, 5)).toEqual([
      [2, 5],
      [5, 6],
      [6, 3],
      [3, 2],
    ]);
    // Turning the second position again gives the third: the four are one orbit.
    const [, second] = rotatedPositions(2, 5);
    expect(rotatedPositions(...(second as [number, number]))[1]).toEqual([6, 3]);
    expect(rotatedPositions(4, 4)).toEqual([
      [4, 4],
      [4, 4],
      [4, 4],
      [4, 4],
    ]);
  });
});
