import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { describeGameProperties, fcParams } from '../../kit/properties';
import type { GameDefinition } from '../../kit/types';

import { azulStateArbitrary } from './arbitrary';

import { azul, scoreAzul, scoreAzulRounds, type AzulState } from './index';

describeGameProperties(azul as GameDefinition<AzulState>, azulStateArbitrary);

describe('azul rule properties', () => {
  it('AZU-FLOOR-3: running total after every round and final total never drop below 0', () => {
    fc.assert(
      fc.property(azulStateArbitrary, (state) => {
        for (const round of scoreAzulRounds(state)) {
          expect(round.totalAfter).toBeGreaterThanOrEqual(0);
        }
        expect(scoreAzul(state).total).toBeGreaterThanOrEqual(0);
      }),
      fcParams(),
    );
  });
});
