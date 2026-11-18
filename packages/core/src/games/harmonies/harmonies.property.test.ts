import { describeGameProperties } from '../../kit/properties';
import type { GameDefinition } from '../../kit/types';

import { harmoniesStateArbitrary } from './arbitrary';

import { harmonies, type HarmoniesState } from './index';

describeGameProperties(harmonies as GameDefinition<HarmoniesState>, harmoniesStateArbitrary);
