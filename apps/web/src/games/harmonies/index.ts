import type { GameUiModule } from '../types';

import { Breakdown } from './breakdown';
import { Editor } from './editor';
import { Motif } from './motif';

export const harmoniesUi: GameUiModule = { Motif, Editor, Breakdown };
