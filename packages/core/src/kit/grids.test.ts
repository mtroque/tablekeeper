import { describe, expect, it } from 'vitest';

import {
  hexCenter,
  hexComponents,
  hexDiameter,
  hexDistances,
  hexKey,
  hexNeighbors,
  type HexLayout,
} from './hex-grid';
import {
  squareCells,
  squareComponents,
  squareDiameter,
  squareDistances,
  squareKey,
  squareNeighbors,
  type SquareLayout,
} from './square-grid';

const grid3: SquareLayout = { rows: 3, cols: 3 };

/** Columns 0 to 6, r from -3 to 6: enough room for every hex case below. */
const hexBoard: HexLayout = {
  cells: Array.from({ length: 70 }, (_, i) => ({ q: Math.floor(i / 10), r: (i % 10) - 3 })),
};

describe('square grid', () => {
  it('lists spaces row-major and leaves out skipped positions', () => {
    const cells = squareCells({ rows: 2, cols: 2, skip: ['0,1'] });
    expect(cells).toEqual([
      { row: 0, col: 0 },
      { row: 1, col: 0 },
      { row: 1, col: 1 },
    ]);
  });

  it('finds orthogonal neighbors inside the board', () => {
    expect(squareNeighbors(grid3, '1,1')).toEqual(['0,1', '1,2', '2,1', '1,0']);
    expect(squareNeighbors(grid3, '0,0')).toEqual(['0,1', '1,0']);
    expect(squareNeighbors({ ...grid3, skip: ['0,1'] }, '0,0')).toEqual(['1,0']);
  });

  it('splits cells into connected groups (diagonals do not connect)', () => {
    const groups = squareComponents(grid3, ['0,0', '0,1', '1,1', '2,2']);
    expect(groups.map((g) => g.sort())).toEqual([['0,0', '0,1', '1,1'], ['2,2']]);
  });

  it('measures shortest paths through the group only', () => {
    // A U shape: going from 0,0 to 0,2 must go around the missing center column.
    const u = ['0,0', '1,0', '2,0', '2,1', '2,2', '1,2', '0,2'];
    const distances = squareDistances(grid3, '0,0', u);
    expect(distances.get('0,2')).toBe(6);
    expect(distances.has('1,1')).toBe(false);
    expect(squareDiameter(grid3, u)).toBe(7);
  });

  it('counts a single cell as diameter 1 and nothing as 0', () => {
    expect(squareDiameter(grid3, [squareKey(1, 1)])).toBe(1);
    expect(squareDiameter(grid3, [])).toBe(0);
  });
});

describe('hex grid', () => {
  it('finds the six axial neighbors that are on the board', () => {
    expect(hexNeighbors(hexBoard, '3,0').sort()).toEqual(
      ['4,0', '2,0', '3,1', '3,-1', '4,-1', '2,1'].sort(),
    );
    expect(hexNeighbors(hexBoard, hexKey(0, -3))).toEqual(['1,-3', '0,-2']);
  });

  it('groups connected cells', () => {
    const groups = hexComponents(hexBoard, ['0,0', '1,0', '3,0', '3,1']);
    expect(groups.map((g) => g.sort())).toEqual([
      ['0,0', '1,0'],
      ['3,0', '3,1'],
    ]);
  });

  it('measures shortest-path distances', () => {
    const line = ['0,0', '1,0', '2,0', '3,0'];
    expect(hexDistances(hexBoard, '0,0', line).get('3,0')).toBe(3);
  });

  it('HAR-WATER-A-1: a branched river of 7 spaces has length 6 (the rulebook p. 8 example)', () => {
    // Six spaces down column 0, plus one branching off beside the third and fourth.
    const river = ['0,0', '0,1', '0,2', '0,3', '0,4', '0,5', '1,2'];
    expect(hexDiameter(hexBoard, river)).toBe(6);
  });

  it('HAR-WATER-A-1: a single water space has length 1', () => {
    expect(hexDiameter(hexBoard, ['2,0'])).toBe(1);
  });

  it('puts odd columns half a space lower', () => {
    const size = 10;
    const top0 = hexCenter({ q: 0, r: 0 }, size);
    const top1 = hexCenter({ q: 1, r: 0 }, size);
    const top2 = hexCenter({ q: 2, r: -1 }, size);
    expect(top1.y - top0.y).toBeCloseTo((Math.sqrt(3) * size) / 2);
    expect(top2.y).toBeCloseTo(top0.y);
  });
});
