import { connectedComponents, distancesFrom, groupDiameter } from './graph';
import type { CellRef } from './types';

/**
 * Flat-topped hexes in axial coordinates, as in docs/games/harmonies.md → Coordinates:
 * `q` is the column, `r = row - floor(q / 2)`, key `"q,r"`.
 */
export type HexCell = { q: number; r: number };

export type HexLayout = { cells: readonly HexCell[] };

export function hexKey(q: number, r: number): string {
  return `${q},${r}`;
}

export function parseHexKey(key: string): HexCell {
  const [q = Number.NaN, r = Number.NaN] = key.split(',').map(Number);
  return { q, r };
}

export function hexRef(q: number, r: number): CellRef {
  return { kind: 'hex', q, r };
}

/** Axial neighbor offsets in the order the game docs list them. */
export const HEX_DIRECTIONS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, -1],
  [-1, 1],
] as const;

export function hexKeys(layout: HexLayout): Set<string> {
  return new Set(layout.cells.map(({ q, r }) => hexKey(q, r)));
}

/** Neighbors of a cell that are spaces of the layout. */
export function hexNeighbors(layout: HexLayout, key: string): string[] {
  const spaces = hexKeys(layout);
  return hexNeighborsIn(spaces, key);
}

function hexNeighborsIn(spaces: ReadonlySet<string>, key: string): string[] {
  const { q, r } = parseHexKey(key);
  return HEX_DIRECTIONS.map(([dq, dr]) => hexKey(q + dq, r + dr)).filter((k) => spaces.has(k));
}

function neighborsOf(layout: HexLayout) {
  const spaces = hexKeys(layout);
  return (key: string) => hexNeighborsIn(spaces, key);
}

export function hexComponents(layout: HexLayout, keys: Iterable<string>): string[][] {
  return connectedComponents(keys, neighborsOf(layout));
}

/** Steps from `start` to every cell of `keys` reachable through `keys`. */
export function hexDistances(
  layout: HexLayout,
  start: string,
  keys: Iterable<string>,
): Map<string, number> {
  return distancesFrom(start, new Set(keys), neighborsOf(layout));
}

/** A connected group's greatest shortest-path distance, in cells, ends included (`HAR-WATER-A-1`). */
export function hexDiameter(layout: HexLayout, group: Iterable<string>): number {
  return groupDiameter(group, neighborsOf(layout));
}

/** Pixel center of a flat-topped hex of the given size (center to corner), `(0,0)` at the origin. */
export function hexCenter({ q, r }: HexCell, size: number): { x: number; y: number } {
  return { x: size * 1.5 * q, y: size * Math.sqrt(3) * (r + q / 2) };
}

/** SVG polygon points of a flat-topped hex. */
export function hexCorners(cx: number, cy: number, size: number): Array<{ x: number; y: number }> {
  return Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 3) * i;
    return { x: cx + size * Math.cos(angle), y: cy + size * Math.sin(angle) };
  });
}
