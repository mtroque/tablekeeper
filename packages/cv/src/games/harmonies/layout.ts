import type { HarmoniesPiece, HarmoniesSide } from '@tablekeeper/core';
import { z } from 'zod';

// The board as the detector needs it, from docs/games/harmonies.md → Board layouts. The same
// facts are in packages/core/src/games/harmonies/layout.ts, but cv may import only types from
// core (docs/ARCHITECTURE.md → Monorepo), so they are repeated here;
// apps/web/src/games/harmonies/detector.test.ts fails if the two ever differ.

export const SIDES: readonly HarmoniesSide[] = ['A', 'B'];

/** Spaces per column as `[q, first r, last r]`. */
const COLUMNS: Record<HarmoniesSide, ReadonlyArray<readonly [number, number, number]>> = {
  A: [
    [0, 0, 4],
    [1, 0, 3],
    [2, -1, 3],
    [3, -1, 2],
    [4, -2, 2],
  ],
  B: [
    [0, 0, 3],
    [1, 0, 2],
    [2, -1, 2],
    [3, -1, 1],
    [4, -2, 1],
    [5, -2, 0],
    [6, -3, 0],
  ],
};

export type Space = { q: number; r: number; key: string };

/** Every space of a side, column by column, top to bottom. */
export const SPACES: Record<HarmoniesSide, readonly Space[]> = {
  A: spacesOf(COLUMNS.A),
  B: spacesOf(COLUMNS.B),
};

function spacesOf(columns: ReadonlyArray<readonly [number, number, number]>): Space[] {
  return columns.flatMap(([q, from, to]) =>
    Array.from({ length: to - from + 1 }, (_, i) => ({ q, r: from + i, key: `${q},${from + i}` })),
  );
}

/** Grid placement in the flattened board rectangle, as fractions of its width. */
export const GRID: Record<HarmoniesSide, { x0: number; y0: number; size: number }> = {
  A: { x0: 0.276, y0: 0.131, size: 0.0735 },
  B: { x0: 0.17, y0: 0.197, size: 0.0739 },
};

/** Board rectangle height over width. */
export const BOARD_ASPECT = 0.79;

/** Token codes (docs/games/harmonies.md → Pieces). */
export const PieceSchema = z.enum([
  'W',
  'F',
  'M',
  'T',
  'L',
  'R',
]) satisfies z.ZodType<HarmoniesPiece>;
