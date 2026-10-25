'use client';

import type { GameId } from '@tablekeeper/core';

import { ComingSoon } from '@/components/coming-soon';
import { GAME_UI } from '@/games/registry';

/** The game's own campaign screen; game slices never add routes. */
export function CampaignRoute({ gameId, name }: { gameId: GameId; name: string }) {
  const { Campaign } = GAME_UI[gameId];
  if (!Campaign) {
    return <ComingSoon title="Coming Soon">The {name} campaign tracker is on its way.</ComingSoon>;
  }
  return <Campaign />;
}
