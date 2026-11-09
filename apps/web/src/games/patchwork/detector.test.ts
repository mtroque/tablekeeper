import { PATCHWORK_FIELD_KEYS, PRALINE_CHITS } from '@tablekeeper/core';
import { BOARD_KEY, SPECIAL_TILE_KEY, TOKEN_KEYS } from '@tablekeeper/cv/games/patchwork';
import { describe, expect, it } from 'vitest';

import { findDetector } from '../detectors';

describe('patchwork detector loader', () => {
  it('is found by the worker lookup and loads a detector', async () => {
    const load = findDetector('patchwork');
    expect(load).toBeTypeOf('function');
    await expect(load?.()).resolves.toHaveProperty('detect');
  });

  it("reports detections on core's confidence keys (cv repeats them, D-065)", () => {
    expect(BOARD_KEY).toBe(PATCHWORK_FIELD_KEYS.board);
    expect(SPECIAL_TILE_KEY).toBe(PATCHWORK_FIELD_KEYS.specialTile);
    for (const chit of PRALINE_CHITS) {
      expect(TOKEN_KEYS[chit.key]).toBe(PATCHWORK_FIELD_KEYS.token(chit.key));
    }
    expect(Object.keys(TOKEN_KEYS).sort()).toEqual(PRALINE_CHITS.map((c) => c.key).sort());
  });
});
