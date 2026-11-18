import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import type { GameDefinition } from './types';

const DEFAULT_RUNS = 100;

function globalSeed(): number | undefined {
  const value = (globalThis as { __FC_SEED__?: unknown }).__FC_SEED__;
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export function fcParams<Ts>(overrides?: fc.Parameters<Ts>): fc.Parameters<Ts> {
  const seed = globalSeed();
  return {
    numRuns: DEFAULT_RUNS,
    ...(seed !== undefined ? { seed } : {}),
    ...overrides,
  };
}

export function assertValidArbitrary<State>(
  game: GameDefinition<State>,
  arb: fc.Arbitrary<State>,
  options?: fc.Parameters<[State]>,
): void {
  fc.assert(
    fc.property(arb, (state) => {
      expect(game.stateSchema.safeParse(state).success).toBe(true);
    }),
    fcParams(options),
  );
}

export function assertInitialState<State>(game: GameDefinition<State>): void {
  const initial = game.initialState();
  expect(game.stateSchema.parse(initial)).toEqual(initial);
  if (game.score) {
    const breakdown = game.score(initial);
    const sum = breakdown.categories.reduce((acc, c) => acc + c.points, 0);
    expect(breakdown.total).toBe(sum);
  }
}

export function assertJsonRoundTrip<State>(
  game: GameDefinition<State>,
  arb: fc.Arbitrary<State>,
  options?: fc.Parameters<[State]>,
): void {
  fc.assert(
    fc.property(arb, (state) => {
      const roundTripped: unknown = JSON.parse(JSON.stringify(state));
      const parsed = game.stateSchema.parse(roundTripped);
      expect(parsed).toEqual(state);
    }),
    fcParams(options),
  );
}

export function assertUpgradeIdentity<State>(
  game: GameDefinition<State>,
  arb: fc.Arbitrary<State>,
  options?: fc.Parameters<[State]>,
): void {
  if (!game.upgrade) return;
  const upgrade = game.upgrade;
  fc.assert(
    fc.property(arb, (state) => {
      expect(upgrade(state, game.stateVersion)).toEqual(state);
    }),
    fcParams(options),
  );
}

export function assertScoreSumAndUniqueKeys<State>(
  game: GameDefinition<State>,
  arb: fc.Arbitrary<State>,
  options?: fc.Parameters<[State]>,
): void {
  if (!game.score) return;
  const score = game.score;
  fc.assert(
    fc.property(arb, (state) => {
      const breakdown = score(state);
      const sum = breakdown.categories.reduce((acc, c) => acc + c.points, 0);
      expect(breakdown.total).toBe(sum);
      const keys = breakdown.categories.map((c) => c.key);
      expect(new Set(keys).size).toBe(keys.length);
    }),
    fcParams(options),
  );
}

export function assertDeterministicPureScore<State>(
  game: GameDefinition<State>,
  arb: fc.Arbitrary<State>,
  options?: fc.Parameters<[State]>,
): void {
  if (!game.score) return;
  const score = game.score;
  fc.assert(
    fc.property(arb, (state) => {
      const snapshot = structuredClone(state);
      const first = score(state);
      const second = score(state);
      expect(second).toEqual(first);
      expect(state).toEqual(snapshot);
    }),
    fcParams(options),
  );
}

/**
 * Registers the shared property-based tests for a `GameDefinition` and its state arbitrary
 * (`docs/CONVENTIONS.md` → Testing).
 */
export function describeGameProperties<State>(
  game: GameDefinition<State>,
  arb: fc.Arbitrary<State>,
  options?: fc.Parameters<[State]>,
): void {
  describe(`${game.id} properties`, () => {
    it('arbitrary generates only states that parse with stateSchema', () => {
      assertValidArbitrary(game, arb, options);
    });

    it('initialState() parses and scores without throwing', () => {
      assertInitialState(game);
    });

    it('round-trips through JSON and stateSchema', () => {
      assertJsonRoundTrip(game, arb, options);
    });

    it('upgrade(state, stateVersion) returns the state unchanged when defined', () => {
      assertUpgradeIdentity(game, arb, options);
    });

    if (game.score) {
      it('score(state).total equals the sum of category points with unique keys', () => {
        assertScoreSumAndUniqueKeys(game, arb, options);
      });

      it('scoring is deterministic and does not mutate the state', () => {
        assertDeterministicPureScore(game, arb, options);
      });
    }
  });
}
