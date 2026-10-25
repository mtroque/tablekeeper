import type { GameUiModule } from '../types';

import { Campaign } from './campaign';
import { Motif } from './motif';
import { ScoreFlow } from './score-flow';

export const dorfromantikUi: GameUiModule = { Motif, ScoreFlow, Campaign };
