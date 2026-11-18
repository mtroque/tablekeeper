import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { describeGameProperties, fcParams } from '../../kit/properties';
import type { GameDefinition } from '../../kit/types';

import { patchworkStateArbitrary } from './arbitrary';

import { patchwork, scorePatchwork, type PatchworkState } from './index';

describeGameProperties(patchwork as GameDefinition<PatchworkState>, patchworkStateArbitrary);

describe('patchwork rule properties', () => {
  it('PAT-SCORE-4: pralines category never scores negative', () => {
    fc.assert(
      fc.property(patchworkStateArbitrary, (state) => {
        const pralines = scorePatchwork(state).categories.find((c) => c.key === 'pralines');
        expect(pralines?.points).toBeGreaterThanOrEqual(0);
      }),
      fcParams(),
    );
  });
});
