import type { GameUiModule } from '../types';

import { Breakdown } from './breakdown';
import { Editor } from './editor';
import { Motif } from './motif';

export const harmoniesUi: GameUiModule = {
  Motif,
  Editor,
  Breakdown,
  samples: ['01-a-pink-table.jpg', '05-b-wood-table.jpg', '03-a-dark-table.jpg'],
};
