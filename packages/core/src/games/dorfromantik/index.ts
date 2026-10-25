import { defineGame } from '../../kit/define';
import type { GameDefinition } from '../../kit/types';

import { blankSheet, initialCampaign } from './campaign';
import {
  DorfromantikCampaignSchema,
  DorfromantikStateSchema,
  type DorfromantikState,
} from './schema';
import { scoreDorfromantik } from './score';

export * from './campaign';
export * from './schema';
export * from './score';
export * from './sheet';

/** Rules, board and state: docs/games/dorfromantik.md. */
export const dorfromantik: GameDefinition = defineGame<DorfromantikState>({
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
  stateSchema: DorfromantikStateSchema,
  stateVersion: 0,
  initialState: () => blankSheet(initialCampaign()),
  score: scoreDorfromantik,
  campaign: { schema: DorfromantikCampaignSchema, initialState: initialCampaign },
});
