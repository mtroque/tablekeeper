import * as fc from 'fast-check';

import { hexKeys } from '../../kit/hex-grid';

import { HARMONIES_LAYOUTS } from './layout';
import { HARMONIES_STACKS, stackPieces, type HarmoniesPiece } from './stacks';
import type { HarmoniesState } from './state';

const SIDE_KEYS = {
  A: [...hexKeys(HARMONIES_LAYOUTS.A)],
  B: [...hexKeys(HARMONIES_LAYOUTS.B)],
} as const;

const cardArb = fc.record({ points: fc.integer({ min: 0, max: 40 }) });
const stackChoiceArb = fc.option(fc.constantFrom(...HARMONIES_STACKS), { nil: null });

function stacksForSide(side: 'A' | 'B'): fc.Arbitrary<Record<string, HarmoniesPiece[]>> {
  const keys = SIDE_KEYS[side];
  return fc
    .array(stackChoiceArb, { minLength: keys.length, maxLength: keys.length })
    .map((picks) => {
      const stacks: Record<string, HarmoniesPiece[]> = {};
      keys.forEach((key, i) => {
        const code = picks[i];
        if (code) stacks[key] = stackPieces(code);
      });
      return stacks;
    });
}

export const harmoniesStateArbitrary: fc.Arbitrary<HarmoniesState> = fc
  .constantFrom<'A' | 'B'>('A', 'B')
  .chain((side) =>
    fc.record({
      side: fc.constant(side),
      stacks: stacksForSide(side),
      animalCards: fc.array(cardArb, { minLength: 0, maxLength: 6 }),
      spiritCards: fc.option(fc.array(cardArb, { minLength: 0, maxLength: 2 }), { nil: undefined }),
    }),
  )
  .map(({ side, stacks, animalCards, spiritCards }) =>
    spiritCards !== undefined
      ? { side, stacks, animalCards, spiritCards }
      : { side, stacks, animalCards },
  );
