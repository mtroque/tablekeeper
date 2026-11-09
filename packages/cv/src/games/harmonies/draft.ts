import type { ConfidenceMap, HarmoniesPiece, HarmoniesState } from '@tablekeeper/core';

import { PieceSchema } from './layout';
import type { BoardReading } from './read';

/**
 * Confidence key for a space's height (`"q,r:height"`). Heights can't be read from a photo taken
 * from above, so it's always 0: the review screen asks for it.
 */
export function heightKey(key: string): string {
  return `${key}:height`;
}

/** Confidence key for the board side. */
export const SIDE_KEY = 'side';

/** Tops whose stack can be more than one token (docs/games/harmonies.md → Valid stacks). */
const ASKS_HEIGHT: ReadonlySet<HarmoniesPiece> = new Set(['M', 'L', 'T', 'R']);

/**
 * The draft state from a reading: each seen top as the shortest valid stack ending in it (`M`,
 * `L`, `T`, `R`, `W`, `F`), empty and occluded spaces left out. Confidence per space (`"q,r"`,
 * from the color match; 0 when occluded), per height that needs asking (`"q,r:height"`, 0), and
 * for the side.
 */
export function draftFromReading(reading: BoardReading): {
  state: HarmoniesState;
  confidence: ConfidenceMap;
} {
  const stacks: Record<string, HarmoniesPiece[]> = {};
  const confidence: ConfidenceMap = { [SIDE_KEY]: reading.sideConfidence };
  for (const space of reading.spaces) {
    confidence[space.key] = space.confidence;
    const top = PieceSchema.safeParse(space.label);
    if (!top.success) continue;
    stacks[space.key] = [top.data];
    if (ASKS_HEIGHT.has(top.data)) confidence[heightKey(space.key)] = 0;
  }
  return { state: { side: reading.side, stacks, animalCards: [] }, confidence };
}
