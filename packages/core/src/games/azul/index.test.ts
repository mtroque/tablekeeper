import { describe, expect, it } from 'vitest';

import { parseState } from '../../kit/state';
import { getGame } from '../registry';

import {
  azul,
  azulEndBonuses,
  azulPlacementScore,
  azulSignedPoints,
  AzulStateSchema,
  checkAzulRound,
  emptyWall,
  floorPenalty,
  scoreAzul,
  scoreAzulRounds,
  wallColor,
  wallIndex,
  type AzulState,
} from '.';

/** A chocolate box with the given spaces occupied. */
function wall(...cells: Array<[number, number]>): boolean[] {
  const next = emptyWall();
  for (const [row, col] of cells) next[wallIndex(row, col)] = true;
  return next;
}

const fullRow = (row: number) =>
  Array.from({ length: 5 }, (_, col): [number, number] => [row, col]);

describe('azul chocolate box', () => {
  it('has the fixed color pattern from the game doc', () => {
    expect([0, 1, 2, 3, 4].map((col) => wallColor(0, col))).toEqual([
      'teal',
      'brown',
      'white',
      'black',
      'red',
    ]);
    expect([0, 1, 2, 3, 4].map((col) => wallColor(1, col))).toEqual([
      'red',
      'teal',
      'brown',
      'white',
      'black',
    ]);
    expect([0, 1, 2, 3, 4].map((row) => wallColor(row, 0))).toEqual([
      'teal',
      'red',
      'black',
      'white',
      'brown',
    ]);
  });
});

describe('azul placement', () => {
  it('AZU-PLACE-2: a tile with no neighbors scores 1', () => {
    expect(azulPlacementScore(wall([2, 2]), 2, 2)).toBe(1);
    // Diagonal tiles aren't neighbors.
    expect(azulPlacementScore(wall([1, 1], [2, 2]), 2, 2)).toBe(1);
  });

  it('AZU-PLACE-3: counts the horizontal run, the vertical run, or both', () => {
    expect(azulPlacementScore(wall([0, 0], [0, 1], [0, 2]), 0, 2)).toBe(3);
    expect(azulPlacementScore(wall([0, 1], [1, 0], [1, 1]), 1, 1)).toBe(4);
    expect(azulPlacementScore(wall([0, 0], [0, 1], [1, 0], [1, 1]), 1, 1)).toBe(4);
    // A gap breaks the run.
    expect(azulPlacementScore(wall([0, 0], [0, 2], [0, 3]), 0, 3)).toBe(2);
    // Vertical only.
    expect(azulPlacementScore(wall([1, 4], [2, 4], [3, 4]), 3, 4)).toBe(3);
  });

  it('AZU-PLACE-1: tiles go in top to bottom, so a later tile sees earlier ones', () => {
    const [round] = scoreAzulRounds({
      rounds: [{ wall: wall([0, 0], [1, 0]), floorCount: 0 }],
    });
    // (0,0) alone scores 1; then (1,0) joins it vertically for 2.
    expect(round?.placements).toEqual([
      { row: 0, col: 0, points: 1 },
      { row: 1, col: 0, points: 2 },
    ]);
  });
});

describe('azul worked examples (docs/games/azul.md)', () => {
  it.each([
    { before: [] as Array<[number, number]>, tile: [2, 2] as [number, number], points: 1 },
    {
      before: [
        [0, 0],
        [0, 1],
      ] as Array<[number, number]>,
      tile: [0, 2] as [number, number],
      points: 3,
    },
    {
      before: [
        [0, 1],
        [1, 0],
      ] as Array<[number, number]>,
      tile: [1, 1] as [number, number],
      points: 4,
    },
    {
      before: [
        [0, 0],
        [0, 1],
        [1, 0],
      ] as Array<[number, number]>,
      tile: [1, 1] as [number, number],
      points: 4,
    },
  ])('placing $tile after $before scores $points', ({ before, tile, points }) => {
    const previous = wall(...before);
    const next = wall(...before, tile);
    expect(azulPlacementScore(next, tile[0], tile[1])).toBe(points);
    // The same through the round model, with the earlier tiles confirmed one per round.
    const rounds = before.map((_, i) => ({ wall: wall(...before.slice(0, i + 1)), floorCount: 0 }));
    const scores = scoreAzulRounds({ rounds: [...rounds, { wall: next, floorCount: 0 }] });
    expect(previous).toEqual(rounds.at(-1)?.wall ?? emptyWall());
    expect(scores.at(-1)?.placements).toEqual([{ row: tile[0], col: tile[1], points }]);
  });

  it('two rounds: 1 + 1 with 3 on the foundry line is floored at 0, then 3 + 4 with 1 is 6', () => {
    // Round 1: (0,0) and (2,0) stand alone. Round 2: (1,0) makes a column run of 3, then
    // (3,0) a run of 4.
    const state: AzulState = {
      rounds: [
        { wall: wall([0, 0], [2, 0]), floorCount: 3 },
        { wall: wall([0, 0], [1, 0], [2, 0], [3, 0]), floorCount: 1 },
      ],
      finished: false,
    };
    const [r1, r2] = scoreAzulRounds(state);
    expect(r1?.placements.map((p) => p.points)).toEqual([1, 1]);
    expect(r1).toMatchObject({ floorPenalty: -4, totalBefore: 0, totalAfter: 0 });
    expect(r2?.placements.map((p) => p.points)).toEqual([3, 4]);
    expect(r2).toMatchObject({ floorPenalty: -1, totalBefore: 0, totalAfter: 6 });
    expect(scoreAzul(state).total).toBe(6);
  });
});

describe('azul foundry line', () => {
  it('AZU-FLOOR-1: penalties by slot are cumulative', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7].map(floorPenalty)).toEqual([0, -1, -2, -4, -6, -8, -11, -14]);
  });

  it('AZU-FLOOR-2: the starting player marker is one of the counted foundry line tiles', () => {
    // The player enters the marker as a filled slot, so 2 tiles plus the marker is 3.
    expect(floorPenalty(2 + 1)).toBe(-4);
  });

  it('AZU-FLOOR-3: the score never drops below 0', () => {
    const scores = scoreAzulRounds({
      rounds: [
        { wall: wall([2, 2]), floorCount: 7 },
        { wall: wall([2, 2]), floorCount: 1 },
      ],
    });
    expect(scores.map((s) => s.totalAfter)).toEqual([0, 0]);
  });
});

describe('azul end bonuses', () => {
  it('AZU-END-1: +2 per complete row', () => {
    expect(azulEndBonuses(wall(...fullRow(0), ...fullRow(3))).points.rows).toBe(4);
  });

  it('AZU-END-2: +7 per complete column', () => {
    const col2 = [0, 1, 2, 3, 4].map((row): [number, number] => [row, 2]);
    expect(azulEndBonuses(wall(...col2)).points).toEqual({ rows: 0, cols: 7, colors: 0 });
  });

  it('AZU-END-3: +10 per color with all 5 tiles', () => {
    // Teal runs down the main diagonal.
    const teal = [0, 1, 2, 3, 4].map((i): [number, number] => [i, i]);
    expect(azulEndBonuses(wall(...teal))).toMatchObject({
      colors: ['teal'],
      points: { colors: 10 },
    });
    expect(azulEndBonuses(wall(...teal.slice(0, 4))).colors).toEqual([]);
  });

  it('AZU-END-4: end bonuses are added once, only when the game is finished', () => {
    const rounds = [{ wall: wall(...fullRow(0)).map((v, i) => v && i < 1), floorCount: 0 }];
    let previous = rounds[0]?.wall ?? emptyWall();
    for (let col = 1; col < 5; col++) {
      previous = previous.map((v, i) => v || i === col);
      rounds.push({ wall: previous, floorCount: 0 });
    }
    const playing = scoreAzul({ rounds, finished: false });
    const finished = scoreAzul({ rounds, finished: true });
    expect(playing.categories.map((c) => c.key)).not.toContain('rows');
    // Rows 1 to 5 of the strip score 1, 2, 3, 4, 5; then one complete row.
    expect(playing.total).toBe(15);
    expect(finished.total).toBe(17);
    expect(finished.categories.filter((c) => c.key === 'rows')).toHaveLength(1);
  });

  it('end bonus example: one complete row, no columns, no full colors is +2', () => {
    expect(azulEndBonuses(wall(...fullRow(4))).points).toEqual({ rows: 2, cols: 0, colors: 0 });
  });
});

describe('azul rounds', () => {
  it('AZU-ROUND-1: only spaces new since the last confirmed round score', () => {
    const scores = scoreAzulRounds({
      rounds: [
        { wall: wall([0, 0]), floorCount: 0 },
        { wall: wall([0, 0], [0, 1]), floorCount: 0 },
      ],
    });
    expect(scores[1]?.placements).toEqual([{ row: 0, col: 1, points: 2 }]);
  });

  it('AZU-ROUND-2: more than one new tile in a row is an error', () => {
    const errors = checkAzulRound(emptyWall(), wall([1, 0], [1, 3]));
    expect(errors).toEqual([
      expect.objectContaining({
        rule: 'AZU-ROUND-2',
        row: 1,
        cells: [
          { row: 1, col: 0 },
          { row: 1, col: 3 },
        ],
        message: 'Row 2 has 2 new tiles. Only 1 tile per row each round.',
      }),
    ]);
    expect(checkAzulRound(emptyWall(), wall([0, 0], [1, 1], [2, 2]))).toEqual([]);
  });

  it('AZU-ROUND-3: a tile missing since the last round is an error', () => {
    const errors = checkAzulRound(wall([0, 0], [3, 2]), wall([0, 0]));
    expect(errors).toEqual([
      expect.objectContaining({ rule: 'AZU-ROUND-3', row: 3, cells: [{ row: 3, col: 2 }] }),
    ]);
  });

  it('AZU-ROUND-2, AZU-ROUND-3: the state schema rejects rounds that break them', () => {
    const twoInRow = { rounds: [{ wall: wall([0, 0], [0, 1]), floorCount: 0 }], finished: false };
    const removed = {
      rounds: [
        { wall: wall([0, 0]), floorCount: 0 },
        { wall: emptyWall(), floorCount: 0 },
      ],
      finished: false,
    };
    expect(AzulStateSchema.safeParse(twoInRow).success).toBe(false);
    const result = AzulStateSchema.safeParse(removed);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['rounds', 1, 'wall']);
  });

  it('AZU-ROUND-4: round score is placements plus penalty; the total never drops below 0', () => {
    const scores = scoreAzulRounds({
      rounds: [
        { wall: wall([0, 0], [1, 1], [2, 2]), floorCount: 0 },
        { wall: wall([0, 0], [1, 1], [2, 2], [3, 3]), floorCount: 4 },
      ],
    });
    expect(scores[0]).toMatchObject({ roundScore: 3, totalAfter: 3 });
    expect(scores[1]).toMatchObject({ roundScore: 1 - 6, totalBefore: 3, totalAfter: 0 });
  });
});

describe('azul breakdown', () => {
  it('one row per round that adds up to the total, with the floor explained', () => {
    const breakdown = scoreAzul({
      rounds: [{ wall: wall([0, 1], [1, 0]), floorCount: 3 }],
      finished: false,
    });
    expect(breakdown.total).toBe(0);
    expect(breakdown.categories).toEqual([
      {
        key: 'round-1',
        label: 'Round 1',
        points: 0,
        highlights: [
          { kind: 'square', row: 0, col: 1 },
          { kind: 'square', row: 1, col: 0 },
          { kind: 'slot', group: 'floor', index: 0 },
          { kind: 'slot', group: 'floor', index: 1 },
          { kind: 'slot', group: 'floor', index: 2 },
        ],
        note: "Tiles 1 + 1. Foundry line −4. The score can't go below 0, so 2 points of it didn't count.",
      },
    ]);
  });

  it('formats signed points with a minus sign', () => {
    expect(azulSignedPoints(3)).toBe('+3');
    expect(azulSignedPoints(0)).toBe('+0');
    expect(azulSignedPoints(-4)).toBe('−4');
  });
});

describe('azul game definition', () => {
  it('is registered with a scorer, starts empty and parses its own initial state', () => {
    expect(getGame('azul')).toBe(azul);
    const initial = azul.initialState();
    expect(parseState(azul, initial, azul.stateVersion)).toEqual({ ok: true, value: initial });
    expect(azul.score?.(initial)).toEqual({ total: 0, categories: [] });
  });
});
