import { describeGameProperties } from '../../kit/properties';
import type { GameDefinition } from '../../kit/types';

import { exampleStateArbitrary } from './arbitrary';

import { exampleGame, type ExampleState } from './index';

describeGameProperties(exampleGame as GameDefinition<ExampleState>, exampleStateArbitrary);
