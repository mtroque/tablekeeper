import type { GameId } from '@tablekeeper/core';

import { azulUi } from './azul';
import { dorfromantikUi } from './dorfromantik';
import { harmoniesUi } from './harmonies';
import { patchworkUi } from './patchwork';
import type { GameUiModule } from './types';

/** Every game's UI module. Pre-registered: game slices never edit this file. */
export const GAME_UI: Record<GameId, GameUiModule> = {
  patchwork: patchworkUi,
  azul: azulUi,
  harmonies: harmoniesUi,
  dorfromantik: dorfromantikUi,
};
