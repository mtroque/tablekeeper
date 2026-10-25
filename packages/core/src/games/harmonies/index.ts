import { z } from 'zod';

import type { GameDefinition } from '../../kit/types';

/** Rules, board and state: docs/games/harmonies.md. */
export const harmonies: GameDefinition = {
  id: 'harmonies',
  name: 'Harmonies',
  edition: 'Base Game',
  rulebook: {
    publisherUrl:
      'https://cdn.svc.asmodee.net/production-libelludv2/uploads/2026/07/HARMONIES_Rules_EN_compressed-1.pdf',
    sourceKey: 'harmonies',
  },
  features: { rules: true, scorer: true, campaign: false, photo: true },
  rulesStarters: [
    'Which tokens can I stack?',
    'How do animal cards work?',
    'When does the game end?',
  ],
  // Placeholder until the game's scorer slice defines the real state.
  stateSchema: z.unknown(),
  stateVersion: 0,
  initialState: () => null,
};
