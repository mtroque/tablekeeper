import { describe, expect, it } from 'vitest';

import {
  FIRST_STEP_MS,
  LAST_STEP_MS,
  MIN_SPIN_STEPS,
  pickIndex,
  spinSteps,
  stepDelays,
} from './spin';

/** A seeded source of uniform 32-bit values (mulberry32), so the test is repeatable. */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  };
}

function sequence(values: number[]): () => number {
  let i = 0;
  return () => {
    const value = values[i++];
    if (value === undefined) throw new Error('sequence ran out');
    return value;
  };
}

describe('pickIndex', () => {
  it.each([2, 3, 5, 8])('gives each of %i players about the same share of wins', (players) => {
    const draws = 10_000 * players;
    const next = seeded(players * 7919);
    const wins = Array.from({ length: players }, () => 0);
    for (let i = 0; i < draws; i++) {
      const winner = pickIndex(players, next);
      wins[winner] = (wins[winner] ?? 0) + 1;
    }
    const expected = draws / players;
    for (const count of wins) expect(Math.abs(count - expected) / expected).toBeLessThan(0.04);
    // Chi-square against uniform, below the 99.9% critical value for 7 degrees of freedom (24.3).
    const chiSquare = wins.reduce((sum, count) => sum + (count - expected) ** 2 / expected, 0);
    expect(chiSquare).toBeLessThan(24.3);
  });

  it('draws again on values from the uneven tail, so no player is favored', () => {
    // For 3 players the top value 2^32 - 1 is outside the evenly divisible range.
    expect(pickIndex(3, sequence([2 ** 32 - 1, 4]))).toBe(1);
    expect(pickIndex(3, sequence([2 ** 32 - 2]))).toBe((2 ** 32 - 2) % 3);
  });

  it('works with the browser source of randomness', () => {
    const next = () => crypto.getRandomValues(new Uint32Array(1))[0] ?? 0;
    for (let i = 0; i < 100; i++) {
      const winner = pickIndex(8, next);
      expect(winner).toBeGreaterThanOrEqual(0);
      expect(winner).toBeLessThan(8);
    }
  });

  it('rejects a bad count or a bad source', () => {
    expect(() => pickIndex(0, seeded(1))).toThrow();
    expect(() => pickIndex(2.5, seeded(1))).toThrow();
    expect(() => pickIndex(2, () => 0.5)).toThrow();
    expect(() => pickIndex(2, () => 2 ** 32)).toThrow();
  });
});

describe('spinSteps', () => {
  it.each([
    [2, 0, 1],
    [3, 2, 0],
    [5, 1, 1],
    [8, 7, 3],
  ])('with %i wedges from %i ends on %i after at least the minimum steps', (count, from, to) => {
    const steps = spinSteps(count, from, to);
    expect(steps.at(-1)).toBe(to);
    expect(steps.length).toBeGreaterThanOrEqual(MIN_SPIN_STEPS);
    expect(steps.length).toBeLessThan(MIN_SPIN_STEPS + 2 * count);
    // Each step moves one wedge clockwise.
    steps.forEach((position, i) => {
      const previous = i === 0 ? from : steps[i - 1];
      expect(position).toBe(((previous ?? 0) + 1) % count);
    });
  });
});

describe('stepDelays', () => {
  it('eases out from the first to the last delay', () => {
    const delays = stepDelays(24);
    expect(delays[0]).toBe(FIRST_STEP_MS);
    expect(delays.at(-1)).toBe(LAST_STEP_MS);
    delays.forEach((delay, i) => {
      if (i > 0) expect(delay).toBeGreaterThanOrEqual(delays[i - 1] ?? 0);
    });
    const total = delays.reduce((sum, delay) => sum + delay, 0);
    expect(total).toBeGreaterThan(2500);
    expect(total).toBeLessThan(4500);
  });

  it('handles tiny spins', () => {
    expect(stepDelays(0)).toEqual([]);
    expect(stepDelays(1)).toEqual([LAST_STEP_MS]);
  });
});
