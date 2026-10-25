import { z } from 'zod';

import type { Campaign } from '../kit/types';

import { GameIdParamSchema, KnownGameIdSchema } from './sessions';

export const CampaignParamsSchema = z.object({ gameId: GameIdParamSchema });

export const CampaignSchema: z.ZodType<Campaign> = z.object({
  id: z.uuid(),
  gameId: KnownGameIdSchema,
  state: z.unknown(),
  stateVersion: z.int().min(0),
  archived: z.boolean(),
  updatedAt: z.iso.datetime({ offset: true }),
});

/** `GET /v1/campaigns/:gameId`: the active campaign, or null before the first save. */
export const CampaignResponseSchema = z.object({ campaign: CampaignSchema.nullable() });
export type CampaignResponse = z.infer<typeof CampaignResponseSchema>;

/** `PUT /v1/campaigns/:gameId`: replaces the active campaign's state (validated by the game). */
export const PutCampaignRequestSchema = z.object({
  state: z.unknown(),
  stateVersion: z.int().min(0),
});
export type PutCampaignRequest = z.infer<typeof PutCampaignRequestSchema>;

/**
 * `POST /v1/campaigns/:gameId/new`: archives the active campaign and starts this one
 * (validated by the game).
 */
export const StartCampaignRequestSchema = PutCampaignRequestSchema;
export type StartCampaignRequest = z.infer<typeof StartCampaignRequestSchema>;
