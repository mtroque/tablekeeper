import type {
  Campaign,
  CampaignResponse,
  GameDefinition,
  PutCampaignRequest,
} from '@tablekeeper/core';

import {
  findActiveCampaign,
  insertCampaign,
  updateCampaignState,
  type CampaignRow,
} from '../db/campaigns';
import { AppError } from '../errors';
import type { AuthContext } from '../types/express';

import { requireGame } from './sessions';

type CampaignGame = GameDefinition & { campaign: NonNullable<GameDefinition['campaign']> };

function requireCampaignGame(gameId: string): CampaignGame {
  const game = requireGame(gameId);
  const { campaign } = game;
  if (!campaign) throw new AppError('VALIDATION', 422, `${game.name} has no campaign.`);
  return { ...game, campaign };
}

function toCampaign(game: GameDefinition, row: CampaignRow): Campaign {
  return {
    id: row.id,
    gameId: game.id,
    state: row.state,
    stateVersion: row.stateVersion,
    archived: row.archived,
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
}

export async function getCampaign(auth: AuthContext, gameId: string): Promise<CampaignResponse> {
  const game = requireCampaignGame(gameId);
  const row = await findActiveCampaign(auth.db, auth.userId, game.id);
  return { campaign: row ? toCampaign(game, row) : null };
}

/** Replaces the active campaign's state, starting one if there is none. */
export async function putCampaign(
  auth: AuthContext,
  gameId: string,
  body: PutCampaignRequest,
): Promise<Campaign> {
  const game = requireCampaignGame(gameId);
  const parsed = game.campaign.schema.safeParse(body.state);
  if (!parsed.success) {
    throw new AppError('VALIDATION', 400, 'The campaign is invalid.', {
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    });
  }
  const existing = await findActiveCampaign(auth.db, auth.userId, game.id);
  const row = existing
    ? await updateCampaignState(auth.db, existing.id, parsed.data, body.stateVersion)
    : await insertCampaign(auth.db, game.id, parsed.data, body.stateVersion);
  return toCampaign(game, row);
}
