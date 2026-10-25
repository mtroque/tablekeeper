import { z } from 'zod';

import { buildBreakdown, category } from '../../kit/breakdown';
import { defineGame } from '../../kit/define';
import { squareCells, squareKey, squareRef, type SquareLayout } from '../../kit/square-grid';
import type { GameDefinition, GameId, ScoreBreakdown } from '../../kit/types';

/** A 3×3 "count covered cells" game for tests and the S1 e2e flow. Not a real game. */
export const EXAMPLE_LAYOUT: SquareLayout = { rows: 3, cols: 3 };

export const ExampleStateSchema = z.object({ cells: z.array(z.boolean()).length(9) });
export type ExampleState = z.infer<typeof ExampleStateSchema>;

/** A campaign only so the campaign routes and page have something to store. */
export const ExampleCampaignSchema = z.object({ gamesPlayed: z.int().min(0) });
export type ExampleCampaign = z.infer<typeof ExampleCampaignSchema>;

export function scoreExample(state: ExampleState): ScoreBreakdown {
  const covered = squareCells(EXAMPLE_LAYOUT).filter(({ row, col }) => state.cells[row * 3 + col]);
  return buildBreakdown([
    category('covered', 'Covered Cells', covered.length, {
      highlights: covered.map(({ row, col }) => squareRef(row, col)),
      note: `${covered.length} of 9 cells covered.`,
    }),
  ]);
}

/** Confidence key of a cell, as `"row,col"`. */
export function exampleCellKey(index: number): string {
  return squareKey(Math.floor(index / 3), index % 3);
}

// Core has no Node types; this is the one place it reads the environment.
declare const process: { env: Record<string, string | undefined> };

/**
 * Only in tests or with `NEXT_PUBLIC_ENABLE_EXAMPLE_GAME=true`. Each variable is read by its
 * full name so Next.js inlines it in browser bundles.
 */
export function isExampleGameEnabled(): boolean {
  try {
    return (
      process.env.NODE_ENV === 'test' || process.env.NEXT_PUBLIC_ENABLE_EXAMPLE_GAME === 'true'
    );
  } catch {
    // No `process` at all (a bare worker): not enabled.
    return false;
  }
}

export const exampleGame: GameDefinition = defineGame<ExampleState>({
  // GameId (kit/types.ts, frozen) lists only real games; the test game is cast in.
  id: '_example' as GameId,
  name: 'Example Game',
  edition: 'Test Board',
  rulebook: { publisherUrl: 'https://example.com/rulebook.pdf', sourceKey: '_example' },
  features: { rules: false, scorer: true, campaign: true, photo: true },
  rulesStarters: [],
  stateSchema: ExampleStateSchema,
  stateVersion: 1,
  initialState: () => ({ cells: Array.from({ length: 9 }, () => false) }),
  score: scoreExample,
  campaign: {
    schema: ExampleCampaignSchema,
    initialState: (): ExampleCampaign => ({ gamesPlayed: 0 }),
  },
});
