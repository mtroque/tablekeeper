// Who goes first (U1): drawing the winner and planning the roulette that lands on it.

const UINT32_RANGE = 2 ** 32;
/** The highlight takes at least this many steps, so a spin feels the same with 2 or 8 players. */
export const MIN_SPIN_STEPS = 24;
export const FIRST_STEP_MS = 50;
export const LAST_STEP_MS = 400;

/**
 * A uniform index in `[0, count)` from a source of uniform 32-bit values (the web passes
 * `crypto.getRandomValues`). Values in the uneven tail of the range are drawn again, so no index
 * is favored by the modulo.
 */
export function pickIndex(count: number, nextUint32: () => number): number {
  if (!Number.isInteger(count) || count < 1 || count > UINT32_RANGE) {
    throw new Error(`pickIndex needs a whole count from 1 to 2^32, got ${count}`);
  }
  const limit = Math.floor(UINT32_RANGE / count) * count;
  for (;;) {
    const value = nextUint32();
    if (!Number.isInteger(value) || value < 0 || value >= UINT32_RANGE) {
      throw new Error(`nextUint32 must return a whole number below 2^32, got ${value}`);
    }
    if (value < limit) return value % count;
  }
}

/**
 * Wedge positions the highlight visits, in clockwise order, starting after `from` and ending on
 * `to`: whole turns (at least `MIN_SPIN_STEPS` steps) and then on to the winner.
 */
export function spinSteps(count: number, from: number, to: number): number[] {
  if (count < 1) return [];
  const turns = Math.max(1, Math.ceil(MIN_SPIN_STEPS / count));
  const extra = (((to - from) % count) + count) % count;
  const total = turns * count + extra;
  return Array.from({ length: total }, (_, i) => (from + i + 1) % count);
}

/** Delay before each step, easing out from `FIRST_STEP_MS` to `LAST_STEP_MS`. */
export function stepDelays(steps: number): number[] {
  if (steps <= 1) return Array.from({ length: steps }, () => LAST_STEP_MS);
  return Array.from({ length: steps }, (_, i) => {
    const t = i / (steps - 1);
    return Math.round(FIRST_STEP_MS + (LAST_STEP_MS - FIRST_STEP_MS) * t ** 3);
  });
}
