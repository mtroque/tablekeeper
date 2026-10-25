import { buildBreakdown, category } from '../../kit/breakdown';
import { squareRef } from '../../kit/square-grid';
import type { CellRef, ScoreBreakdown, ScoreCategory } from '../../kit/types';

import { currentWall, type AzulState } from './state';
import {
  AZUL_COLORS,
  emptyWall,
  FLOOR_GROUP,
  FLOOR_PENALTIES,
  WALL_SIZE,
  wallColor,
  wallIndex,
  type AzulColor,
} from './wall';

/** Signed points with a real minus sign, e.g. "+3", "−4". */
export function azulSignedPoints(points: number): string {
  return points < 0 ? `−${-points}` : `+${points}`;
}

function run(wall: readonly boolean[], row: number, col: number, dr: number, dc: number): number {
  let count = 0;
  let r = row + dr;
  let c = col + dc;
  while (r >= 0 && c >= 0 && r < WALL_SIZE && c < WALL_SIZE && wall[wallIndex(r, c)]) {
    count++;
    r += dr;
    c += dc;
  }
  return count;
}

/**
 * Points for a tile placed at (row, col) given the tiles already there (AZU-PLACE-2, -3).
 * The space itself is counted as occupied.
 */
export function azulPlacementScore(wall: readonly boolean[], row: number, col: number): number {
  const horizontal = 1 + run(wall, row, col, 0, -1) + run(wall, row, col, 0, 1);
  const vertical = 1 + run(wall, row, col, -1, 0) + run(wall, row, col, 1, 0);
  if (horizontal === 1 && vertical === 1) return 1;
  return (horizontal > 1 ? horizontal : 0) + (vertical > 1 ? vertical : 0);
}

/** Total foundry line penalty for `count` tiles there (AZU-FLOOR-1), as a negative number. */
export function floorPenalty(count: number): number {
  return FLOOR_PENALTIES.slice(0, Math.max(0, count)).reduce<number>((sum, p) => sum + p, 0);
}

export type AzulPlacement = { row: number; col: number; points: number };

export type AzulRoundScore = {
  /** 1-based. */
  round: number;
  /** New tiles top row first, each scored as it is placed (AZU-PLACE-1). */
  placements: AzulPlacement[];
  floorCount: number;
  floorPenalty: number;
  /** Placements plus foundry line penalty (AZU-ROUND-4). */
  roundScore: number;
  totalBefore: number;
  /** Never below 0 (AZU-FLOOR-3). */
  totalAfter: number;
};

/** Every round's score and running total, from the chocolate boxes alone (AZU-ROUND-1, -4). */
export function scoreAzulRounds(state: Pick<AzulState, 'rounds'>): AzulRoundScore[] {
  const scores: AzulRoundScore[] = [];
  let previous: readonly boolean[] = emptyWall();
  let total = 0;
  state.rounds.forEach((round, i) => {
    const working = [...previous];
    const placements: AzulPlacement[] = [];
    for (let row = 0; row < WALL_SIZE; row++) {
      for (let col = 0; col < WALL_SIZE; col++) {
        const index = wallIndex(row, col);
        if (!round.wall[index] || previous[index]) continue;
        working[index] = true;
        placements.push({ row, col, points: azulPlacementScore(working, row, col) });
      }
    }
    const penalty = floorPenalty(round.floorCount);
    const roundScore = placements.reduce((sum, p) => sum + p.points, 0) + penalty;
    const totalAfter = Math.max(0, total + roundScore);
    scores.push({
      round: i + 1,
      placements,
      floorCount: round.floorCount,
      floorPenalty: penalty,
      roundScore,
      totalBefore: total,
      totalAfter,
    });
    total = totalAfter;
    previous = round.wall;
  });
  return scores;
}

export type AzulEndBonuses = {
  rows: number[];
  cols: number[];
  colors: AzulColor[];
  points: { rows: number; cols: number; colors: number };
};

/** Complete rows (AZU-END-1), columns (AZU-END-2) and colors (AZU-END-3). */
export function azulEndBonuses(wall: readonly boolean[]): AzulEndBonuses {
  const lines = Array.from({ length: WALL_SIZE }, (_, i) => i);
  const rows = lines.filter((row) => lines.every((col) => wall[wallIndex(row, col)]));
  const cols = lines.filter((col) => lines.every((row) => wall[wallIndex(row, col)]));
  const colors = AZUL_COLORS.filter((color) =>
    lines.every((row) =>
      lines.some((col) => wallColor(row, col) === color && wall[wallIndex(row, col)]),
    ),
  );
  return {
    rows,
    cols,
    colors,
    points: { rows: rows.length * 2, cols: cols.length * 7, colors: colors.length * 10 },
  };
}

function listOf(items: readonly string[]): string {
  return items.length < 2
    ? items.join('')
    : `${items.slice(0, -1).join(', ')} and ${items.at(-1) ?? ''}`;
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

function roundCategory(score: AzulRoundScore): ScoreCategory {
  const parts = [
    score.placements.length > 0
      ? `Tiles ${score.placements.map((p) => p.points).join(' + ')}.`
      : 'No new tiles.',
    ...(score.floorCount > 0 ? [`Foundry line ${azulSignedPoints(score.floorPenalty)}.`] : []),
  ];
  const change = score.totalAfter - score.totalBefore;
  if (change !== score.roundScore) {
    const kept = change - score.roundScore;
    parts.push(
      `The score can't go below 0, so ${plural(kept, 'point', 'points')} of it didn't count.`,
    );
  }
  const highlights: CellRef[] = [
    ...score.placements.map(({ row, col }) => squareRef(row, col)),
    ...Array.from({ length: score.floorCount }, (_, index): CellRef => ({
      kind: 'slot',
      group: FLOOR_GROUP,
      index,
    })),
  ];
  return category(`round-${score.round}`, `Round ${score.round}`, change, {
    highlights,
    note: parts.join(' '),
  });
}

function cellsWhere(wall: readonly boolean[], match: (row: number, col: number) => boolean) {
  const refs: CellRef[] = [];
  for (let row = 0; row < WALL_SIZE; row++) {
    for (let col = 0; col < WALL_SIZE; col++) {
      if (wall[wallIndex(row, col)] && match(row, col)) refs.push(squareRef(row, col));
    }
  }
  return refs;
}

/**
 * One row per confirmed round (its change to the running total, so the rows add up to the
 * total), then the end bonuses once the game is finished (AZU-END-4).
 */
export function scoreAzul(state: AzulState): ScoreBreakdown {
  const categories = scoreAzulRounds(state).map(roundCategory);
  if (state.finished) {
    const wall = currentWall(state);
    const bonus = azulEndBonuses(wall);
    categories.push(
      category('rows', 'Complete Rows', bonus.points.rows, {
        highlights: cellsWhere(wall, (row) => bonus.rows.includes(row)),
        note:
          bonus.rows.length > 0
            ? `${plural(bonus.rows.length, 'row', 'rows')}, 2 points each.`
            : 'No complete rows.',
      }),
      category('columns', 'Complete Columns', bonus.points.cols, {
        highlights: cellsWhere(wall, (_, col) => bonus.cols.includes(col)),
        note:
          bonus.cols.length > 0
            ? `${plural(bonus.cols.length, 'column', 'columns')}, 7 points each.`
            : 'No complete columns.',
      }),
      category('colors', 'Full Colors', bonus.points.colors, {
        highlights: cellsWhere(wall, (row, col) => bonus.colors.includes(wallColor(row, col))),
        note:
          bonus.colors.length > 0
            ? `All 5 tiles of ${listOf(bonus.colors)}, 10 points each.`
            : 'No color has all 5 tiles.',
      }),
    );
  }
  return buildBreakdown(categories);
}
