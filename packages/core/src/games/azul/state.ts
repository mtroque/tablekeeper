import { z } from 'zod';

import type { SquareCell } from '../../kit/square-grid';

import { emptyWall, FLOOR_SLOTS, WALL_SIZE, wallIndex } from './wall';

/** An input limit, not a rule: no real game comes close. */
export const AZUL_MAX_ROUNDS = 50;

export type AzulRoundError =
  | { rule: 'AZU-ROUND-2'; row: number; cells: SquareCell[]; message: string }
  | { rule: 'AZU-ROUND-3'; row: number; cells: SquareCell[]; message: string };

/**
 * What's wrong with a round's chocolate box compared with the last confirmed one: more than
 * one new tile in a row (AZU-ROUND-2) or a tile that disappeared (AZU-ROUND-3).
 */
export function checkAzulRound(
  previous: readonly boolean[],
  wall: readonly boolean[],
): AzulRoundError[] {
  const errors: AzulRoundError[] = [];
  for (let row = 0; row < WALL_SIZE; row++) {
    const added: SquareCell[] = [];
    for (let col = 0; col < WALL_SIZE; col++) {
      const before = previous[wallIndex(row, col)] === true;
      const now = wall[wallIndex(row, col)] === true;
      if (before && !now) {
        errors.push({
          rule: 'AZU-ROUND-3',
          row,
          cells: [{ row, col }],
          message: `Row ${row + 1}, column ${col + 1} had a tile last round. Put it back, or edit the last round.`,
        });
      }
      if (!before && now) added.push({ row, col });
    }
    if (added.length > 1) {
      errors.push({
        rule: 'AZU-ROUND-2',
        row,
        cells: added,
        message: `Row ${row + 1} has ${added.length} new tiles. Only 1 tile per row each round.`,
      });
    }
  }
  return errors;
}

export const AzulRoundSchema = z.object({
  wall: z.array(z.boolean()).length(WALL_SIZE * WALL_SIZE),
  floorCount: z.int().min(0).max(FLOOR_SLOTS),
});
export type AzulRound = z.infer<typeof AzulRoundSchema>;

/** docs/games/azul.md → State. Scores are derived, never stored as input. */
export const AzulStateSchema = z
  .object({
    rounds: z.array(AzulRoundSchema).max(AZUL_MAX_ROUNDS),
    finished: z.boolean(),
  })
  .superRefine((state, ctx) => {
    let previous: readonly boolean[] = emptyWall();
    state.rounds.forEach((round, i) => {
      for (const error of checkAzulRound(previous, round.wall)) {
        ctx.addIssue({
          code: 'custom',
          path: ['rounds', i, 'wall'],
          message: `Round ${i + 1}: ${error.message}`,
        });
      }
      previous = round.wall;
    });
  });
export type AzulState = z.infer<typeof AzulStateSchema>;

/** The chocolate box after the last confirmed round. */
export function currentWall(state: Pick<AzulState, 'rounds'>): boolean[] {
  return state.rounds.at(-1)?.wall ?? emptyWall();
}
