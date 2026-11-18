import * as fc from 'fast-check';

import type { AzulRound, AzulState } from './state';
import { emptyWall, FLOOR_SLOTS, WALL_SIZE, wallIndex } from './wall';

const MAX_GENERATED_ROUNDS = 10;

type RowMove = { row: number; col: number | null };

const roundMovesArb = fc.tuple(
  fc.option(fc.integer({ min: 0, max: WALL_SIZE - 1 }), { nil: null }),
  fc.option(fc.integer({ min: 0, max: WALL_SIZE - 1 }), { nil: null }),
  fc.option(fc.integer({ min: 0, max: WALL_SIZE - 1 }), { nil: null }),
  fc.option(fc.integer({ min: 0, max: WALL_SIZE - 1 }), { nil: null }),
  fc.option(fc.integer({ min: 0, max: WALL_SIZE - 1 }), { nil: null }),
  fc.integer({ min: 0, max: FLOOR_SLOTS }),
);

function applyMoves(wall: boolean[], moves: readonly RowMove[]): boolean[] {
  const next = [...wall];
  for (const { row, col } of moves) {
    if (col !== null) next[wallIndex(row, col)] = true;
  }
  return next;
}

export const azulStateArbitrary: fc.Arbitrary<AzulState> = fc
  .record({
    roundSpecs: fc.array(roundMovesArb, { minLength: 0, maxLength: MAX_GENERATED_ROUNDS }),
    finished: fc.boolean(),
  })
  .map(({ roundSpecs, finished }) => {
    let wall = emptyWall();
    const rounds: AzulRound[] = roundSpecs.map(([c0, c1, c2, c3, c4, floorCount]) => {
      const cols = [c0, c1, c2, c3, c4];
      const moves: RowMove[] = cols.map((col, row) => ({
        row,
        col: col !== null && !wall[wallIndex(row, col)] ? col : null,
      }));
      wall = applyMoves(wall, moves);
      return { wall, floorCount };
    });
    return { rounds, finished };
  });
