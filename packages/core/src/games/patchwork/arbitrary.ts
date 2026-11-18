import * as fc from 'fast-check';

import { PATCHWORK_BOARDS, type PatchworkState } from './index';

export const patchworkStateArbitrary: fc.Arbitrary<PatchworkState> = fc.record({
  board: fc.constantFrom(...PATCHWORK_BOARDS),
  grid: fc.array(fc.boolean(), { minLength: 81, maxLength: 81 }),
  tokens: fc.record({
    one: fc.integer({ min: 0, max: 32 }),
    five: fc.integer({ min: 0, max: 12 }),
    ten: fc.integer({ min: 0, max: 5 }),
    twenty: fc.integer({ min: 0, max: 1 }),
  }),
  specialTile: fc.boolean(),
});
