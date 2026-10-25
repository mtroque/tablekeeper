import { describe, expect, it } from 'vitest';

import { parseState } from '../../kit/state';
import { getGame } from '../registry';

import {
  initialPatchworkState,
  patchwork,
  patchworkCellKey,
  patchworkPralines,
  scorePatchwork,
  type PatchworkState,
  type PatchworkTokens,
} from '.';

/** A board with the given flat indexes empty and everything else covered. */
function board(empty: number[], over: Partial<PatchworkState> = {}): PatchworkState {
  const grid = Array.from({ length: 81 }, (_, i) => !empty.includes(i));
  return { ...initialPatchworkState(), grid, ...over };
}
const firstEmpty = (n: number) => Array.from({ length: n }, (_, i) => i);
const chits = (one: number, five: number, ten: number, twenty: number): PatchworkTokens => ({
  one,
  five,
  ten,
  twenty,
});
const points = (state: PatchworkState, key: string) =>
  scorePatchwork(state).categories.find((row) => row.key === key)?.points;

describe('patchwork scoring', () => {
  it('PAT-SCORE-1: pralines plus 7 for the special tile minus 2 per empty space', () => {
    const state = board(firstEmpty(3), { tokens: chits(10, 0, 0, 0), specialTile: true });
    expect(scorePatchwork(state).total).toBe(10 + 7 - 6);
  });

  it('PAT-SCORE-2: a space is empty unless covered; a petit four covers exactly one space', () => {
    // A petit four on space 40 is one covered space: the other 80 stay empty.
    const grid = Array.from({ length: 81 }, (_, i) => i === 40);
    const state = { ...initialPatchworkState(), grid };
    expect(points(state, 'emptySpaces')).toBe(-160);
    const highlights = scorePatchwork(state).categories.find(
      (r) => r.key === 'emptySpaces',
    )?.highlights;
    expect(highlights).toHaveLength(80);
    expect(highlights).not.toContainEqual({ kind: 'square', row: 4, col: 4 });
  });

  it('PAT-SCORE-3: the special tile is worth 7, taken from the player without checking the 7×7', () => {
    expect(points(board([], { specialTile: true }), 'specialTile')).toBe(7);
    expect(points(board([], { specialTile: false }), 'specialTile')).toBe(0);
  });

  it('PAT-SCORE-4: pralines held are 1, 5, 10 and 20 per chit', () => {
    expect(patchworkPralines(chits(1, 1, 1, 1))).toBe(36);
    expect(patchworkPralines(chits(32, 12, 5, 1))).toBe(32 + 60 + 50 + 20);
    expect(points(board([], { tokens: chits(6, 3, 2, 0) }), 'pralines')).toBe(41);
  });

  it('PAT-SCORE-5: scores can be negative', () => {
    expect(scorePatchwork(board(firstEmpty(81))).total).toBe(-162);
  });

  it.each([
    { empty: 6, tokens: chits(6, 3, 2, 0), tile: true, expected: 36 },
    { empty: 6, tokens: chits(6, 3, 2, 1), tile: true, expected: 56 },
    { empty: 5, tokens: chits(4, 0, 1, 0), tile: true, expected: 11 },
    { empty: 0, tokens: chits(0, 0, 0, 0), tile: true, expected: 7 },
    { empty: 81, tokens: chits(5, 0, 0, 0), tile: false, expected: -157 },
  ])(
    'worked example: $empty empty, chits $tokens, special tile $tile scores $expected',
    ({ empty, tokens, tile, expected }) => {
      expect(scorePatchwork(board(firstEmpty(empty), { tokens, specialTile: tile })).total).toBe(
        expected,
      );
    },
  );

  it('highlights exactly the empty spaces and nothing else', () => {
    const empty = [0, 8, 40, 72, 80];
    const breakdown = scorePatchwork(board(empty));
    const withHighlights = breakdown.categories.filter((row) => row.highlights);
    expect(withHighlights.map((row) => row.key)).toEqual(['emptySpaces']);
    expect(withHighlights[0]?.highlights).toEqual([
      { kind: 'square', row: 0, col: 0 },
      { kind: 'square', row: 0, col: 8 },
      { kind: 'square', row: 4, col: 4 },
      { kind: 'square', row: 8, col: 0 },
      { kind: 'square', row: 8, col: 8 },
    ]);
  });

  it('a full board has no highlights and says so', () => {
    const row = scorePatchwork(board([])).categories.find((r) => r.key === 'emptySpaces');
    expect(row).toEqual({
      key: 'emptySpaces',
      label: 'Empty Spaces',
      points: 0,
      note: 'No empty spaces.',
    });
  });

  it('notes which chits were counted', () => {
    const row = scorePatchwork(board([], { tokens: chits(4, 0, 1, 0) })).categories[0];
    expect(row?.note).toBe('4 × 1, 1 × 10.');
  });

  it('the board color does not change the score', () => {
    const red = board(firstEmpty(4), { board: 'red', tokens: chits(3, 1, 0, 0) });
    expect(scorePatchwork({ ...red, board: 'gray' })).toEqual(scorePatchwork(red));
  });
});

describe('patchwork definition', () => {
  it('is registered with a scorer and starts as an empty red board', () => {
    expect(getGame('patchwork')).toBe(patchwork);
    const initial = patchwork.initialState();
    expect(initial).toEqual(initialPatchworkState());
    expect(patchwork.score?.(initial).total).toBe(-162);
  });

  it('validates stored state', () => {
    expect(parseState(patchwork, initialPatchworkState(), 1).ok).toBe(true);
    const short = { ...initialPatchworkState(), grid: Array.from({ length: 80 }, () => true) };
    expect(parseState(patchwork, short, 1).ok).toBe(false);
    const negative = { ...initialPatchworkState(), tokens: chits(-1, 0, 0, 0) };
    expect(parseState(patchwork, negative, 1).ok).toBe(false);
    expect(parseState(patchwork, { ...initialPatchworkState(), board: 'blue' }, 1).ok).toBe(false);
  });

  it('keys spaces as "row,col"', () => {
    expect(patchworkCellKey(0)).toBe('0,0');
    expect(patchworkCellKey(40)).toBe('4,4');
    expect(patchworkCellKey(80)).toBe('8,8');
  });
});
