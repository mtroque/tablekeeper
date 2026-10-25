import { z } from 'zod';

import type { GameDefinition } from '../../kit/types';

/** Rules, board and state: docs/games/dorfromantik.md. */
export const dorfromantik: GameDefinition = {
  id: 'dorfromantik',
  name: 'Dorfromantik',
  edition: 'Base Game',
  rulebook: {
    publisherUrl:
      'https://cdn.pegasus.de/public/media/14/0f/e2/1717757209/4250231735486_en-min.pdf?ts=1752574415',
    sourceKey: 'dorfromantik',
  },
  features: { rules: true, scorer: true, campaign: true, photo: false },
  rulesStarters: [
    'How do task markers work?',
    'When is a territory closed?',
    'How does the game end?',
  ],
  // Placeholder until the game's scorer slice defines the real state.
  stateSchema: z.unknown(),
  stateVersion: 0,
  initialState: () => null,
};
