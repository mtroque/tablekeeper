import type { GameUiModule } from '../types';

import { Breakdown } from './breakdown';
import { Campaign } from './campaign';
import { Editor } from './editor';
import { Motif } from './motif';
import { ScoreFlow } from './score-flow';

/** The S1 test game (`packages/core/src/games/_example`). */
export const exampleUi: GameUiModule = { Motif, Editor, Breakdown, ScoreFlow, Campaign };
