import type { GameUiModule } from '../types';

import { Breakdown } from './breakdown';
import { Editor } from './editor';
import { Motif } from './motif';

export const harmoniesUi: GameUiModule = {
  Motif,
  Editor,
  Breakdown,
  detector: () => import('@tablekeeper/cv/games/harmonies').then((m) => m.detector),
  samples: ['01-a-pink-table.jpg', '05-b-wood-table.jpg', '03-a-dark-table.jpg'],
};
