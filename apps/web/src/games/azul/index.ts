import type { GameUiModule } from '../types';

import { Breakdown } from './breakdown';
import { Motif } from './motif';
import { ScoreFlow } from './score-flow';

/** Round by round entry by tap; no photo (docs/games/azul.md → Board). */
export const azulUi: GameUiModule = { Motif, Breakdown, ScoreFlow };
