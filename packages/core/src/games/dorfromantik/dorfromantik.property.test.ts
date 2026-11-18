import { describeGameProperties } from '../../kit/properties';
import type { GameDefinition } from '../../kit/types';

import { dorfromantikStateArbitrary } from './arbitrary';

import { dorfromantik, type DorfromantikState } from './index';

describeGameProperties(
  dorfromantik as GameDefinition<DorfromantikState>,
  dorfromantikStateArbitrary,
);
