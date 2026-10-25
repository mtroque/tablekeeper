import { defineGame } from '../../kit/define';
import type { GameDefinition } from '../../kit/types';

import { scoreAzul } from './scoring';
import { AzulStateSchema, type AzulState } from './state';

export * from './wall';
export * from './state';
export * from './scoring';

/** Rules, board and state: docs/games/azul.md. */
export const azul: GameDefinition = defineGame<AzulState>({
  id: 'azul',
  name: 'Azul',
  edition: 'Master Chocolatier',
  rulebook: {
    publisherUrl:
      'https://cdn.svc.asmodee.net/production-nextmove/uploads/sites/4/2024/06/EN-Azul-chocolate-rulebook-V2-May27_compressed.pdf',
    sourceKey: 'azul',
  },
  features: { rules: true, scorer: true, campaign: false, photo: false },
  rulesStarters: [
    'What happens to tiles on the foundry line?',
    'How does box confection score?',
    'When does the game end?',
  ],
  stateSchema: AzulStateSchema,
  // The first real shape; the S0 placeholder could never be saved, so nothing to upgrade.
  stateVersion: 0,
  initialState: (): AzulState => ({ rounds: [], finished: false }),
  score: scoreAzul,
});
