import {
  HARMONIES_BOARD_ASPECT,
  HARMONIES_GRID,
  HARMONIES_LAYOUTS,
  HARMONIES_SIDES,
  HarmoniesStateSchema,
  hexKey,
} from '@tablekeeper/core';
import {
  BOARD_ASPECT,
  draftFromReading,
  GRID,
  HARMONIES_CV_SPACES,
} from '@tablekeeper/cv/games/harmonies';
import { describe, expect, it } from 'vitest';

// cv may import only types from core, so the detector keeps its own copy of the board
// (packages/cv/src/games/harmonies/layout.ts). This is where the two are held together.

describe('harmonies detector board', () => {
  it.each(HARMONIES_SIDES)(
    'side %s: the same spaces, grid placement and aspect as core',
    (side) => {
      expect(HARMONIES_CV_SPACES[side].map((s) => s.key)).toEqual(
        HARMONIES_LAYOUTS[side].cells.map((c) => hexKey(c.q, c.r)),
      );
      expect(GRID[side]).toEqual(HARMONIES_GRID[side]);
      expect(BOARD_ASPECT).toBe(HARMONIES_BOARD_ASPECT);
    },
  );

  it.each(HARMONIES_SIDES)('side %s: a draft with every top is a valid state', (side) => {
    const tops = ['W', 'F', 'M', 'T', 'L', 'R', 'empty', 'occluded'];
    const draft = draftFromReading({
      side,
      sideConfidence: 1,
      spaces: HARMONIES_CV_SPACES[side].map((space, i) => ({
        key: space.key,
        label: tops[i % tops.length] ?? 'empty',
        confidence: 1,
        features: [],
        cubeShare: 0,
      })),
    });
    expect(HarmoniesStateSchema.safeParse(draft.state).success).toBe(true);
  });
});
