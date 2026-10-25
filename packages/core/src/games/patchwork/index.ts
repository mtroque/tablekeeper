import { z } from 'zod';

import { buildBreakdown, category } from '../../kit/breakdown';
import { defineGame } from '../../kit/define';
import { squareCells, squareKey, squareRef, type SquareLayout } from '../../kit/square-grid';
import type { GameDefinition, ScoreBreakdown } from '../../kit/types';

/** Rules, board and state: docs/games/patchwork.md. */
export const PATCHWORK_LAYOUT: SquareLayout = { rows: 9, cols: 9 };
const SPACES = 81;

export const PATCHWORK_BOARDS = ['red', 'gray'] as const;
export type PatchworkBoard = (typeof PATCHWORK_BOARDS)[number];

/** Praline chits by value, with how many of each the box holds (PAT-SCORE-4). */
export const PRALINE_CHITS = [
  { key: 'one', value: 1, inBox: 32 },
  { key: 'five', value: 5, inBox: 12 },
  { key: 'ten', value: 10, inBox: 5 },
  { key: 'twenty', value: 20, inBox: 1 },
] as const;
export type PralineChitKey = (typeof PRALINE_CHITS)[number]['key'];

const chitCount = z.int().min(0);

export const PatchworkStateSchema = z.object({
  board: z.enum(PATCHWORK_BOARDS),
  /** Row-major, `row * 9 + col`; true = covered. */
  grid: z.array(z.boolean()).length(SPACES),
  tokens: z.object({ one: chitCount, five: chitCount, ten: chitCount, twenty: chitCount }),
  specialTile: z.boolean(),
});
export type PatchworkState = z.infer<typeof PatchworkStateSchema>;
export type PatchworkTokens = PatchworkState['tokens'];

export const SPECIAL_TILE_POINTS = 7;
export const EMPTY_SPACE_PENALTY = 2;

/** Pralines held: the face value of every chit (PAT-SCORE-4). */
export function patchworkPralines(tokens: PatchworkTokens): number {
  return PRALINE_CHITS.reduce((sum, chit) => sum + chit.value * tokens[chit.key], 0);
}

/** Confidence key of a space, as `"row,col"`. */
export function patchworkCellKey(index: number): string {
  return squareKey(Math.floor(index / 9), index % 9);
}

/** Confidence keys of the fields that aren't spaces. */
export const PATCHWORK_FIELD_KEYS = {
  board: 'board',
  specialTile: 'specialTile',
  token: (key: PralineChitKey) => `tokens.${key}`,
} as const;

export function scorePatchwork(state: PatchworkState): ScoreBreakdown {
  const pralines = patchworkPralines(state.tokens);
  const held = PRALINE_CHITS.filter((chit) => state.tokens[chit.key] > 0);
  const empty = squareCells(PATCHWORK_LAYOUT).filter(({ row, col }) => !state.grid[row * 9 + col]);

  return buildBreakdown([
    category('pralines', 'Pralines', pralines, {
      note:
        held.length > 0
          ? `${held.map((chit) => `${state.tokens[chit.key]} × ${chit.value}`).join(', ')}.`
          : 'No praline chits.',
    }),
    category('specialTile', 'Special Tile', state.specialTile ? SPECIAL_TILE_POINTS : 0, {
      note: state.specialTile ? 'You hold the special tile.' : "You don't hold the special tile.",
    }),
    category('emptySpaces', 'Empty Spaces', 0 - EMPTY_SPACE_PENALTY * empty.length, {
      highlights: empty.map(({ row, col }) => squareRef(row, col)),
      note:
        empty.length === 0
          ? 'No empty spaces.'
          : `${empty.length} ${empty.length === 1 ? 'space' : 'spaces'} at ${EMPTY_SPACE_PENALTY} each.`,
    }),
  ]);
}

export function initialPatchworkState(): PatchworkState {
  return {
    board: 'red',
    grid: Array.from({ length: SPACES }, () => false),
    tokens: { one: 0, five: 0, ten: 0, twenty: 0 },
    specialTile: false,
  };
}

export const patchwork: GameDefinition = defineGame<PatchworkState>({
  id: 'patchwork',
  name: 'Patchwork',
  edition: "Valentine's Day",
  rulebook: {
    publisherUrl:
      'https://www.lookout-spiele.de/upload/en_patchworkvalentine.html_PW_Valentine_Regeln_EN_web.pdf',
    sourceKey: 'patchwork',
  },
  features: { rules: true, scorer: true, campaign: false, photo: true },
  rulesStarters: [
    'How do I collect pralines?',
    'Who gets the special tile?',
    'How does the game end?',
  ],
  stateSchema: PatchworkStateSchema,
  // Version 0 was S0's placeholder with no state; there is nothing to upgrade from it.
  stateVersion: 1,
  initialState: initialPatchworkState,
  score: scorePatchwork,
});
