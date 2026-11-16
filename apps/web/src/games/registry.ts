import type { GameId } from '@tablekeeper/core';
import { enableExampleGame, exampleGame } from '@tablekeeper/core';

import { isExampleGameEnabled } from '@/lib/env';

import { exampleUi } from './_example';
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

// The S1 test game, only when enabled. It isn't a GameId (kit/types.ts is frozen), so it's
// added through a widened view of the record.
if (isExampleGameEnabled()) {
  enableExampleGame(true);
  (GAME_UI as Record<string, GameUiModule>)[exampleGame.id] = exampleUi;
}
