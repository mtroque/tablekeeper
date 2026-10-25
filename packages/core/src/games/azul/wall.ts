import { squareKey, type SquareLayout } from '../../kit/square-grid';

/** The chocolate box (`wall` in code): docs/games/azul.md → Wall. */
export const WALL_SIZE = 5;
export const WALL_LAYOUT: SquareLayout = { rows: WALL_SIZE, cols: WALL_SIZE };

export const AZUL_COLORS = ['teal', 'brown', 'white', 'black', 'red'] as const;
export type AzulColor = (typeof AZUL_COLORS)[number];

/** Row 0 runs through the colors left to right; each next row shifts right by one. */
export function wallColor(row: number, col: number): AzulColor {
  return AZUL_COLORS[(((col - row) % WALL_SIZE) + WALL_SIZE) % WALL_SIZE] ?? 'teal';
}

/** Flat index of a space, `row * 5 + col`. */
export function wallIndex(row: number, col: number): number {
  return row * WALL_SIZE + col;
}

/** Confidence and highlight key of a space, as `"row,col"`. */
export function wallKey(index: number): string {
  return squareKey(Math.floor(index / WALL_SIZE), index % WALL_SIZE);
}

export function emptyWall(): boolean[] {
  return Array.from({ length: WALL_SIZE * WALL_SIZE }, () => false);
}

/** Foundry line penalty per slot, left to right (AZU-FLOOR-1). */
export const FLOOR_PENALTIES = [-1, -1, -2, -2, -2, -3, -3] as const;
export const FLOOR_SLOTS = FLOOR_PENALTIES.length;
/** `CellRef` group of the foundry line slots. */
export const FLOOR_GROUP = 'floor';
