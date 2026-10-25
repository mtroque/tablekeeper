import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { buildBreakdown, category } from './breakdown';
import { parseState } from './state';

const v2 = {
  stateSchema: z.object({ tiles: z.array(z.number()) }),
  stateVersion: 2,
  upgrade: (state: unknown, fromVersion: number): unknown => {
    let next = state;
    if (fromVersion < 1) next = { count: (next as { n: number }).n };
    if (fromVersion < 2) next = { tiles: [(next as { count: number }).count] };
    return next;
  },
};

describe('parseState', () => {
  it('validates current-version state', () => {
    expect(parseState(v2, { tiles: [1, 2] }, 2)).toEqual({ ok: true, value: { tiles: [1, 2] } });
  });

  it('upgrades older state step by step before validating', () => {
    expect(parseState(v2, { n: 4 }, 0)).toEqual({ ok: true, value: { tiles: [4] } });
  });

  it('rejects invalid state with its issues', () => {
    const result = parseState(v2, { tiles: ['x'] }, 2);
    expect(result.ok).toBe(false);
    if (!result.ok && result.error.kind === 'invalid') {
      expect(result.error.issues[0]?.path).toBe('tiles.0');
    }
  });

  it('rejects versions newer than the game knows, and old ones with no upgrade', () => {
    expect(parseState(v2, { tiles: [] }, 3)).toMatchObject({
      ok: false,
      error: { kind: 'future-version' },
    });
    const { upgrade: _, ...noUpgrade } = v2;
    expect(parseState(noUpgrade, { tiles: [] }, 1)).toMatchObject({
      ok: false,
      error: { kind: 'no-upgrade' },
    });
  });
});

describe('breakdown', () => {
  it('sums categories into the total, including negative points', () => {
    const breakdown = buildBreakdown([
      category('a', 'Buttons', 12),
      category('b', 'Empty Spaces', -4, { note: '2 empty spaces.' }),
    ]);
    expect(breakdown.total).toBe(8);
    expect(breakdown.categories[1]).toEqual({
      key: 'b',
      label: 'Empty Spaces',
      points: -4,
      note: '2 empty spaces.',
    });
  });

  it('leaves out empty highlights', () => {
    expect(category('a', 'A', 1, { highlights: [] })).toEqual({ key: 'a', label: 'A', points: 1 });
  });
});
