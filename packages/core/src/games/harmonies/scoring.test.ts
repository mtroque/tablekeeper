import { describe, expect, it } from 'vitest';

import { parseState } from '../../kit/state';
import { getGame } from '../registry';

import {
  harmonies,
  HARMONIES_LAYOUTS,
  HARMONIES_STACKS,
  harmoniesRiverPoints,
  isValidStack,
  scoreHarmonies,
  stackPieces,
  type HarmoniesState,
} from '.';

/** A board from `{ "q,r": "TTL" }` codes. */
function board(
  side: HarmoniesState['side'],
  codes: Record<string, string>,
  extra: Partial<HarmoniesState> = {},
): HarmoniesState {
  const stacks = Object.fromEntries(
    Object.entries(codes).map(([key, code]) => [key, stackPieces(code)]),
  );
  return { side, stacks, animalCards: [], ...extra };
}

const points = (state: HarmoniesState, key: string) =>
  scoreHarmonies(state).categories.find((row) => row.key === key)?.points;

const water = (keys: string[]) => Object.fromEntries(keys.map((key) => [key, 'W']));

describe('harmonies layouts', () => {
  it('side A has 23 spaces and side B 25, all distinct', () => {
    expect(HARMONIES_LAYOUTS.A.cells).toHaveLength(23);
    expect(HARMONIES_LAYOUTS.B.cells).toHaveLength(25);
    for (const layout of Object.values(HARMONIES_LAYOUTS)) {
      const keys = layout.cells.map(({ q, r }) => `${q},${r}`);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it('starts columns 2 and up at negative r', () => {
    expect(HARMONIES_LAYOUTS.A.cells).toContainEqual({ q: 4, r: -2 });
    expect(HARMONIES_LAYOUTS.B.cells).toContainEqual({ q: 6, r: -3 });
    expect(HARMONIES_LAYOUTS.A.cells).not.toContainEqual({ q: 4, r: 3 });
  });
});

describe('harmonies stacks', () => {
  it('HAR-STACK-1: water and fields are single tokens', () => {
    expect(isValidStack(stackPieces('W'))).toBe(true);
    expect(isValidStack(stackPieces('F'))).toBe(true);
    for (const code of ['WW', 'FF', 'WR', 'FR', 'WL', 'FM']) {
      expect(isValidStack(stackPieces(code))).toBe(false);
    }
  });

  it('HAR-STACK-2: mountains are 1 to 3 gray tokens', () => {
    for (const code of ['M', 'MM', 'MMM']) expect(isValidStack(stackPieces(code))).toBe(true);
    expect(isValidStack(stackPieces('MMMM'))).toBe(false);
  });

  it('HAR-STACK-3: trees are leaves on 0 to 2 trunks; bare trunks are valid', () => {
    for (const code of ['L', 'TL', 'TTL', 'T', 'TT']) {
      expect(isValidStack(stackPieces(code))).toBe(true);
    }
    for (const code of ['TTTL', 'TTT', 'LL', 'LT', 'ML']) {
      expect(isValidStack(stackPieces(code))).toBe(false);
    }
  });

  it('HAR-STACK-4: a roof goes on one mountain, trunk or roof, or alone', () => {
    for (const code of ['R', 'MR', 'TR', 'RR']) expect(isValidStack(stackPieces(code))).toBe(true);
    for (const code of ['MMR', 'TTR', 'RRR', 'LR', 'RM', 'RT']) {
      expect(isValidStack(stackPieces(code))).toBe(false);
    }
  });

  it('HAR-STACK-5: exactly 14 stacks are valid, and no empty stack', () => {
    expect(HARMONIES_STACKS).toHaveLength(14);
    expect(isValidStack([])).toBe(false);
  });
});

describe('harmonies state', () => {
  it('is the registered game, starts empty on side A and scores 0', () => {
    expect(getGame('harmonies')).toBe(harmonies);
    const initial = harmonies.initialState();
    expect(initial).toEqual({ side: 'A', stacks: {}, animalCards: [] });
    expect(harmonies.score?.(initial).total).toBe(0);
  });

  it('accepts a valid board', () => {
    const state = board('B', { '6,-3': 'TTL', '0,0': 'W' }, { spiritCards: [{ points: 3 }] });
    expect(parseState(harmonies, state, 1).ok).toBe(true);
  });

  it.each([
    ['a space not on that side', board('A', { '6,-3': 'W' })],
    ['an invalid stack', { side: 'A', stacks: { '0,0': ['W', 'W'] }, animalCards: [] }],
    ['an empty stack', { side: 'A', stacks: { '0,0': [] }, animalCards: [] }],
    ['an unknown piece', { side: 'A', stacks: { '0,0': ['X'] }, animalCards: [] }],
    ['an unknown side', { side: 'C', stacks: {}, animalCards: [] }],
    ['negative card points', { side: 'A', stacks: {}, animalCards: [{ points: -1 }] }],
    ['fractional card points', { side: 'A', stacks: {}, animalCards: [{ points: 1.5 }] }],
  ])('rejects %s', (_, state) => {
    expect(parseState(harmonies, state, 1).ok).toBe(false);
  });

  it("rejects S0's placeholder version", () => {
    expect(parseState(harmonies, null, 0).ok).toBe(false);
  });
});

describe('harmonies scoring', () => {
  it('HAR-TREE-1: leaves on two trunks score 7', () => {
    expect(points(board('A', { '0,0': 'TTL' }), 'trees')).toBe(7);
  });

  it('HAR-TREE-1: leaves alone score 1, on one trunk 3; bare trunks score 0', () => {
    expect(points(board('A', { '0,0': 'L', '0,2': 'TL', '0,4': 'T', '2,0': 'TT' }), 'trees')).toBe(
      4,
    );
  });

  it('HAR-MTN-1: mountains score 1, 3 and 7 by height', () => {
    expect(points(board('A', { '0,0': 'M', '0,1': 'MM', '0,2': 'MMM' }), 'mountains')).toBe(11);
  });

  it('HAR-MTN-2: a mountain with no mountain next to it scores 0', () => {
    expect(points(board('A', { '2,1': 'MM' }), 'mountains')).toBe(0);
  });

  it('HAR-MTN-2: two mountains next to each other both score', () => {
    const state = board('A', { '2,1': 'MM', '2,2': 'M' });
    expect(points(state, 'mountains')).toBe(4);
    expect(scoreHarmonies(state).categories[1]?.highlights).toHaveLength(2);
  });

  it('HAR-MTN-2: a building on a mountain is not a mountain neighbor', () => {
    expect(points(board('A', { '2,1': 'MM', '2,2': 'MR' }), 'mountains')).toBe(0);
  });

  it('HAR-FIELD-1: each group of 2 or more fields scores 5, single fields 0', () => {
    expect(points(board('A', { '0,0': 'F', '0,1': 'F', '4,2': 'F' }), 'fields')).toBe(5);
    expect(
      points(board('A', { '0,0': 'F', '0,1': 'F', '4,1': 'F', '4,2': 'F', '2,1': 'F' }), 'fields'),
    ).toBe(10);
  });

  it('HAR-BLD-1: a building next to 3 different top colors scores 5', () => {
    expect(
      points(board('A', { '2,1': 'MR', '3,1': 'W', '1,1': 'F', '2,2': 'L' }), 'buildings'),
    ).toBe(5);
  });

  it('HAR-BLD-1: 2 colors, repeated colors and empty spaces are not enough', () => {
    expect(
      points(
        board('A', { '2,1': 'TR', '3,1': 'W', '1,1': 'W', '2,2': 'L', '2,0': 'TL' }),
        'buildings',
      ),
    ).toBe(0);
  });

  it('HAR-BLD-1: a lone roof is not a building', () => {
    expect(
      points(board('A', { '2,1': 'R', '3,1': 'W', '1,1': 'F', '2,2': 'L' }), 'buildings'),
    ).toBe(0);
  });

  it('HAR-WATER-A-1: only the longest river scores', () => {
    const state = board('A', water(['0,0', '0,1', '0,2', '4,0', '4,1']));
    expect(points(state, 'water')).toBe(5);
    expect(
      scoreHarmonies(state).categories.find((c) => c.key === 'water')?.highlights,
    ).toHaveLength(3);
  });

  it('HAR-WATER-A-1: a single water space has length 1 and scores 0', () => {
    expect(points(board('A', water(['2,1'])), 'water')).toBe(0);
  });

  it('HAR-WATER-A-2: river points by length, 4 more per space beyond 6', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8].map(harmoniesRiverPoints)).toEqual([
      0, 0, 2, 5, 8, 11, 15, 19, 23,
    ]);
  });

  it('HAR-WATER-A-2: a water path of 4 scores 8', () => {
    expect(points(board('A', water(['0,0', '0,1', '0,2', '0,3'])), 'water')).toBe(8);
  });

  it("HAR-WATER-A-1: the rulebook's p. 8 example, a branch off the path doesn't count", () => {
    // Ends 6 apart along the shortest path, plus (2,0) branching off it.
    const state = board('A', water(['2,-1', '1,0', '1,1', '0,2', '0,3', '1,3', '2,0']));
    expect(points(state, 'water')).toBe(15);
  });

  it("HAR-WATER-A-1: the rulebook's p. 9 example, 7 spaces in a chain score 19", () => {
    const state = board('A', water(['2,-1', '1,0', '1,1', '0,2', '0,3', '1,3', '2,3']));
    expect(points(state, 'water')).toBe(19);
  });

  it('HAR-WATER-B-1: with no water the board is 1 island', () => {
    expect(points(board('B', { '0,0': 'F', '3,0': 'TTL' }), 'water')).toBe(5);
  });

  it('HAR-WATER-B-1: water across the board makes 2 islands; empty spaces are land', () => {
    expect(points(board('B', water(['3,-1', '3,0', '3,1'])), 'water')).toBe(10);
  });

  it('HAR-WATER-B-1: there is always at least 1 island', () => {
    const all = HARMONIES_LAYOUTS.B.cells.map(({ q, r }) => `${q},${r}`);
    expect(points(board('B', water(all)), 'water')).toBe(5);
  });

  it('HAR-ANIMAL-1: animal cards sum into one category', () => {
    const state = board('A', {}, { animalCards: [{ points: 10 }, { points: 4 }] });
    expect(points(state, 'animals')).toBe(14);
  });

  it("HAR-SPIRIT-1: a Nature's Spirit card worth 14 scores 14 in its own category", () => {
    const state = board('A', {}, { spiritCards: [{ points: 14 }] });
    const row = scoreHarmonies(state).categories.find((c) => c.key === 'spirits');
    expect(row).toMatchObject({ label: "Nature's Spirit", points: 14 });
  });

  it("HAR-SPIRIT-1: no Nature's Spirit row without cards", () => {
    expect(points(board('A', {}), 'spirits')).toBeUndefined();
    expect(points(board('A', {}, { spiritCards: [] }), 'spirits')).toBeUndefined();
  });

  it('HAR-TOTAL-1: the total sums every category', () => {
    const state = board(
      'A',
      {
        '0,0': 'TTL', // trees 7
        '2,1': 'MM', // mountains 3 + 1
        '2,2': 'M',
        '4,1': 'F', // fields 5
        '4,2': 'F',
        '1,0': 'MR', // building: W, L, T tops around it
        '1,1': 'TT',
        '0,1': 'W', // river of 2: 2
        '0,2': 'W',
      },
      { animalCards: [{ points: 9 }], spiritCards: [{ points: 6 }] },
    );
    const breakdown = scoreHarmonies(state);
    expect(Object.fromEntries(breakdown.categories.map((c) => [c.key, c.points]))).toEqual({
      trees: 7,
      mountains: 4,
      fields: 5,
      buildings: 5,
      water: 2,
      animals: 9,
      spirits: 6,
    });
    expect(breakdown.total).toBe(38);
  });
});
