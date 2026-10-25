import { describe, expect, it } from 'vitest';

import { parseState } from '../../kit/state';

import { exampleGame, isExampleGameEnabled, scoreExample } from '.';

describe('example game', () => {
  it('scores one point per covered cell and highlights them', () => {
    const cells = [true, false, false, false, true, false, false, false, true];
    const breakdown = scoreExample({ cells });
    expect(breakdown.total).toBe(3);
    expect(breakdown.categories[0]?.highlights).toEqual([
      { kind: 'square', row: 0, col: 0 },
      { kind: 'square', row: 1, col: 1 },
      { kind: 'square', row: 2, col: 2 },
    ]);
  });

  it('starts empty and rejects boards of the wrong size', () => {
    expect(exampleGame.score?.(exampleGame.initialState()).total).toBe(0);
    expect(parseState(exampleGame, { cells: [true] }, 1).ok).toBe(false);
  });

  it('is enabled under test', () => {
    expect(isExampleGameEnabled()).toBe(true);
  });
});
