import type { GameUiModule } from '../types';

import { Breakdown } from './breakdown';
import { Editor } from './editor';
import { Motif } from './motif';

/** Patchwork: Valentine's Day (`packages/core/src/games/patchwork`). */
export const patchworkUi: GameUiModule = { Motif, Editor, Breakdown };
