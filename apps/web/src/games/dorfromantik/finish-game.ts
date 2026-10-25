import {
  dorfromantik,
  nextGameNumber,
  recordGame,
  withVisibleExtras,
  type DorfromantikState,
} from '@tablekeeper/core';

import type { SessionStore } from '@/lib/session-store/session-store';

import { readCampaign, writeCampaign, type ActiveCampaign } from './use-campaign';
import type { FinishedGame } from './use-sheet';

/**
 * Saves a finished sheet: a completed session linked to the campaign, then the campaign with
 * the game recorded. `pending` is a session already saved by an earlier try whose campaign
 * write failed, so a retry never saves the game twice.
 */
export async function finishGame(
  store: SessionStore,
  sheet: DorfromantikState,
  pending: FinishedGame | null,
  onSessionSaved: (game: FinishedGame) => void,
): Promise<{ game: FinishedGame; campaign: ActiveCampaign }> {
  const stored = readCampaign(await store.getCampaign(dorfromantik.id));
  // The session links to the campaign, so a first game creates it.
  const campaign = stored.id ? stored : await writeCampaign(store, stored.state);
  if (!campaign.id) throw new Error('The campaign has no id.');

  let game = pending;
  if (!game) {
    const state = {
      ...withVisibleExtras(sheet, campaign.state),
      gameNumber: nextGameNumber(campaign.state),
    };
    const session = await store.save({
      gameId: dorfromantik.id,
      status: 'completed',
      state,
      stateVersion: dorfromantik.stateVersion,
      campaignId: campaign.id,
    });
    game = {
      sessionId: session.id,
      gameNumber: state.gameNumber,
      total: session.scoreTotal ?? 0,
      recorded: false,
      unlocksDone: false,
    };
    onSessionSaved(game);
  }

  const updated = await writeCampaign(
    store,
    recordGame(campaign.state, {
      sessionId: game.sessionId,
      gameNumber: game.gameNumber,
      total: game.total,
    }),
  );
  return { game: { ...game, recorded: true }, campaign: updated };
}
