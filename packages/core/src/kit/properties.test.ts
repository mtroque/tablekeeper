import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { defineGame } from './define';
import {
  assertDeterministicPureScore,
  assertInitialState,
  assertJsonRoundTrip,
  assertScoreSumAndUniqueKeys,
  assertUpgradeIdentity,
  assertValidArbitrary,
  describeGameProperties,
} from './properties';
import type { GameDefinition, GameId } from './types';

const ToyStateSchema = z.object({ a: z.int().min(0).max(10), b: z.int().min(0).max(10) });
type ToyState = z.infer<typeof ToyStateSchema>;

const toyArb: fc.Arbitrary<ToyState> = fc.record({
  a: fc.integer({ min: 0, max: 10 }),
  b: fc.integer({ min: 0, max: 10 }),
});

const validToy = defineGame<ToyState>({
  id: '_example' as GameId,
  name: 'Toy',
  edition: 'Test',
  rulebook: { publisherUrl: 'https://example.com', sourceKey: 'toy' },
  features: { rules: false, scorer: true, campaign: false, photo: false },
  rulesStarters: [],
  stateSchema: ToyStateSchema,
  stateVersion: 1,
  upgrade: (state) => state,
  initialState: () => ({ a: 0, b: 0 }),
  score: (state) => ({
    total: state.a + state.b,
    categories: [
      { key: 'a', label: 'A', points: state.a },
      { key: 'b', label: 'B', points: state.b },
    ],
  }),
}) as GameDefinition<ToyState>;

describeGameProperties(validToy, toyArb, { numRuns: 20 });

describe('property test helpers reject broken games', () => {
  it('rejects an arbitrary that emits invalid states', () => {
    const badArb = fc.record({ a: fc.constant(-1), b: fc.constant(0) });
    expect(() => {
      assertValidArbitrary(validToy, badArb, { numRuns: 5 });
    }).toThrow();
  });

  it('rejects a scorer whose total omits a category', () => {
    const broken = {
      ...validToy,
      score: (state: ToyState) => ({
        total: state.a,
        categories: [
          { key: 'a', label: 'A', points: state.a },
          { key: 'b', label: 'B', points: state.b },
        ],
      }),
    };
    const nonZeroB = toyArb.filter((s) => s.b > 0);
    expect(() => {
      assertScoreSumAndUniqueKeys(broken, nonZeroB, { numRuns: 10 });
    }).toThrow(/seed:/);
  });

  it('rejects a scorer with duplicate category keys', () => {
    const broken = {
      ...validToy,
      score: (state: ToyState) => ({
        total: state.a + state.b,
        categories: [
          { key: 'dup', label: 'A', points: state.a },
          { key: 'dup', label: 'B', points: state.b },
        ],
      }),
    };
    expect(() => {
      assertScoreSumAndUniqueKeys(broken, toyArb, { numRuns: 5 });
    }).toThrow();
  });

  it('rejects a non-deterministic scorer', () => {
    let calls = 0;
    const broken = {
      ...validToy,
      score: (state: ToyState) => {
        calls += 1;
        return {
          total: state.a + calls,
          categories: [{ key: 'a', label: 'A', points: state.a + calls }],
        };
      },
    };
    expect(() => {
      assertDeterministicPureScore(broken, toyArb, { numRuns: 5 });
    }).toThrow();
  });

  it('rejects a scorer that mutates the state', () => {
    const broken = {
      ...validToy,
      score: (state: ToyState) => {
        state.a += 1;
        return { total: state.a, categories: [{ key: 'a', label: 'A', points: state.a }] };
      },
    };
    expect(() => {
      assertDeterministicPureScore(broken, toyArb, { numRuns: 5 });
    }).toThrow();
  });

  it('rejects a state that fails JSON round-trip', () => {
    const brokenSchema = z.object({ a: z.number(), b: z.number() });
    const broken = {
      ...validToy,
      stateSchema: brokenSchema,
    };
    const arbWithNaN = fc.record({
      a: fc.constant(Number.NaN),
      b: fc.constant(0),
    });
    expect(() => {
      assertJsonRoundTrip(broken, arbWithNaN, { numRuns: 5 });
    }).toThrow();
  });

  it('rejects an upgrade that alters a current-version state', () => {
    const broken = {
      ...validToy,
      upgrade: (state: unknown) => ({ ...(state as ToyState), a: 99 }),
    };
    const arbNot99 = toyArb;
    expect(() => {
      assertUpgradeIdentity(broken, arbNot99, { numRuns: 5 });
    }).toThrow();
  });

  it('rejects an invalid initialState()', () => {
    const broken = {
      ...validToy,
      initialState: () => ({ a: -1, b: 0 }),
    };
    expect(() => {
      assertInitialState(broken);
    }).toThrow();
  });
});
