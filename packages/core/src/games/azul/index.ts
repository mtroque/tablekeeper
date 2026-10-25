import { z } from 'zod';

import type { GameDefinition } from '../../kit/types';

/** Rules, board and state: docs/games/azul.md. */
export const azul: GameDefinition = {
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
  // Placeholder until the game's scorer slice defines the real state.
  stateSchema: z.unknown(),
  stateVersion: 0,
  initialState: () => null,
};
