import type { GameUiModule } from '../types';

import { Breakdown } from './breakdown';
import { Editor } from './editor';
import { Motif } from './motif';

/** Patchwork: Valentine's Day (`packages/core/src/games/patchwork`). */
export const patchworkUi: GameUiModule = {
  Motif,
  Editor,
  Breakdown,
  // One photo of each box board, from the fixtures (docs/DATA_ASSETS.md → Sample photos).
  samples: ['red-board.jpg', 'gray-board.jpg', 'red-board-special-tile.jpg'],
};
