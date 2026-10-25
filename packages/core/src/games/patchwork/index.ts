import { z } from 'zod';

import type { GameDefinition } from '../../kit/types';

/** Rules, board and state: docs/games/patchwork.md. */
export const patchwork: GameDefinition = {
  id: 'patchwork',
  name: 'Patchwork',
  edition: "Valentine's Day",
  rulebook: {
    publisherUrl:
      'https://www.lookout-spiele.de/upload/en_patchworkvalentine.html_PW_Valentine_Regeln_EN_web.pdf',
    sourceKey: 'patchwork',
  },
  features: { rules: true, scorer: true, campaign: false, photo: true },
  rulesStarters: [
    'How do I collect pralines?',
    'Who gets the special tile?',
    'How does the game end?',
  ],
  // Placeholder until the game's scorer slice defines the real state.
  stateSchema: z.unknown(),
  stateVersion: 0,
  initialState: () => null,
};
