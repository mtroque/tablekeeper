import * as fc from 'fast-check';

import type { ExampleState } from './index';

export const exampleStateArbitrary: fc.Arbitrary<ExampleState> = fc.record({
  cells: fc.array(fc.boolean(), { minLength: 9, maxLength: 9 }),
});
