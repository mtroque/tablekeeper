import { defineGame } from '../../kit/define';
import type { GameDefinition } from '../../kit/types';

import { scoreHarmonies } from './scoring';
import { emptyHarmoniesState, HarmoniesStateSchema, type HarmoniesState } from './state';

export * from './layout';
export * from './scoring';
export * from './stacks';
export * from './state';

/** Rules, board and state: docs/games/harmonies.md. */
export const harmonies: GameDefinition = defineGame<HarmoniesState>({
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
  stateSchema: HarmoniesStateSchema,
  // Version 0 was S0's placeholder (`null`), which could never be saved: no upgrade step.
  stateVersion: 1,
  initialState: () => emptyHarmoniesState(),
  score: scoreHarmonies,
});
