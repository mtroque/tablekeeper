import { buildBreakdown, category } from '../../kit/breakdown';
import type { ScoreBreakdown, ScoreCategory } from '../../kit/types';

import type { DorfromantikState } from './schema';
import { EXTRA_ROWS, type ExtraRow } from './sheet';

/** Scoresheet ids: docs/games/dorfromantik.md → Scoresheet. */

/** Points for one section E row: count × multiplier; Circus is yes / no worth 10. */
export function extraPoints(row: ExtraRow, value: number | boolean | undefined): number {
  if (value === undefined) return 0;
  if (typeof value === 'boolean') return value ? row.multiplier : 0;
  return value * row.multiplier;
}

export type Subtotals = {
  /** DOR-S1: B1 + … + B5. */
  tasks: number;
  /** DOR-S2: C1 + C2 + C3 + D1 + D2. */
  flagsLongest: number;
  /** DOR-S3: sum of the E rows. */
  unlocked: number;
  /** DOR-H: S1 + S2 + S3. */
  total: number;
};

export function subtotals(state: DorfromantikState): Subtotals {
  const { tasks, flags, longest, extras } = state;
  const s1 = tasks.forest + tasks.grain + tasks.village + tasks.track + tasks.stream;
  const s2 = flags.green + flags.yellow + flags.red + longest.track + longest.stream;
  const s3 = EXTRA_ROWS.reduce((sum, row) => sum + extraPoints(row, extras[row.id]), 0);
  return { tasks: s1, flagsLongest: s2, unlocked: s3, total: s1 + s2 + s3 };
}

export function scoreDorfromantik(state: DorfromantikState): ScoreBreakdown {
  const { tasks, flags, longest, extras } = state;
  const parts = subtotals(state);
  const categories: ScoreCategory[] = [
    category('tasks', 'Tasks', parts.tasks, {
      note:
        `Forest ${tasks.forest}, grain ${tasks.grain}, village ${tasks.village}, ` +
        `track ${tasks.track}, stream ${tasks.stream}.`,
    }),
    category('flags-longest', 'Flags and Longest', parts.flagsLongest, {
      note:
        `Green flags ${flags.green}, yellow flags ${flags.yellow}, red flags ${flags.red}, ` +
        `longest track ${longest.track}, longest stream ${longest.stream}.`,
    }),
  ];
  const rows = EXTRA_ROWS.filter((row) => extras[row.id] !== undefined);
  if (rows.length > 0) {
    categories.push(
      category('unlocked', 'Unlocked Components', parts.unlocked, {
        note: `${rows.map((row) => `${row.label} ${extraPoints(row, extras[row.id])}`).join(', ')}.`,
      }),
    );
  }
  return buildBreakdown(categories);
}
