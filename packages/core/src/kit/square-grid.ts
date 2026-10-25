import { connectedComponents, distancesFrom, groupDiameter } from './graph';
import type { CellRef } from './types';

/** An N×M board; `skip` lists keys of positions that aren't spaces. */
export type SquareLayout = { rows: number; cols: number; skip?: readonly string[] };

export type SquareCell = { row: number; col: number };

export function squareKey(row: number, col: number): string {
  return `${row},${col}`;
}

export function parseSquareKey(key: string): SquareCell {
  const [row = Number.NaN, col = Number.NaN] = key.split(',').map(Number);
  return { row, col };
}

export function squareRef(row: number, col: number): CellRef {
  return { kind: 'square', row, col };
}

/** Every space of the layout in row-major order. */
export function squareCells(layout: SquareLayout): SquareCell[] {
  const skip = new Set(layout.skip);
  const cells: SquareCell[] = [];
  for (let row = 0; row < layout.rows; row++) {
    for (let col = 0; col < layout.cols; col++) {
      if (!skip.has(squareKey(row, col))) cells.push({ row, col });
    }
  }
  return cells;
}

export function isSquareCell(layout: SquareLayout, row: number, col: number): boolean {
  return (
    Number.isInteger(row) &&
    Number.isInteger(col) &&
    row >= 0 &&
    col >= 0 &&
    row < layout.rows &&
    col < layout.cols &&
    !layout.skip?.includes(squareKey(row, col))
  );
}

const ORTHOGONAL = [
  [-1, 0],
  [0, 1],
  [1, 0],
  [0, -1],
] as const;

/** Orthogonal neighbors (up, right, down, left) that are spaces of the layout. */
export function squareNeighbors(layout: SquareLayout, key: string): string[] {
  const { row, col } = parseSquareKey(key);
  return ORTHOGONAL.filter(([dr, dc]) => isSquareCell(layout, row + dr, col + dc)).map(([dr, dc]) =>
    squareKey(row + dr, col + dc),
  );
}

export function squareComponents(layout: SquareLayout, keys: Iterable<string>): string[][] {
  return connectedComponents(keys, (key) => squareNeighbors(layout, key));
}

/** Steps from `start` to every cell of `keys` reachable through `keys`. */
export function squareDistances(
  layout: SquareLayout,
  start: string,
  keys: Iterable<string>,
): Map<string, number> {
  return distancesFrom(start, new Set(keys), (key) => squareNeighbors(layout, key));
}

/** A connected group's greatest shortest-path distance, in cells, ends included. */
export function squareDiameter(layout: SquareLayout, group: Iterable<string>): number {
  return groupDiameter(group, (key) => squareNeighbors(layout, key));
}
