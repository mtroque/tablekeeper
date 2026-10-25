import { z } from 'zod';

import { MAX_RED_HEARTS, UNLOCK_IDS, type ExtraRowId } from './sheet';

/** Shapes per docs/games/dorfromantik.md → State. */

const MAX_COUNT = 999;
const Count = z.int().min(0).max(MAX_COUNT);

export const UnlockIdSchema = z.enum(UNLOCK_IDS);

/** Section E inputs: Circus is yes / no, every other row a count. */
export const ExtrasSchema = z.strictObject({
  'DOR-E-GOLDHEART': Count.exactOptional(),
  'DOR-E-BALLOON': Count.exactOptional(),
  'DOR-E-CONSTRUCTION': Count.exactOptional(),
  'DOR-E-HILL': Count.exactOptional(),
  'DOR-E-SHEPHERDESS': Count.exactOptional(),
  'DOR-E-SIGNALMAN': Count.exactOptional(),
  'DOR-E-CIRCUS': z.boolean().exactOptional(),
  'DOR-E-REDHEARTS': Count.exactOptional(),
  'DOR-E-HARBOR': Count.exactOptional(),
  'DOR-E-TRAINSTATION': Count.exactOptional(),
  'DOR-E-SHIP': Count.exactOptional(),
  'DOR-E-LOCOMOTIVE': Count.exactOptional(),
  'DOR-E-WATCHTOWER': Count.exactOptional(),
  'DOR-E-HARVEST': Count.exactOptional(),
  'DOR-E-CABIN': Count.exactOptional(),
}) satisfies z.ZodType<Partial<Record<ExtraRowId, number | boolean>>>;

export const DorfromantikStateSchema = z.object({
  gameNumber: z.int().min(1),
  tasks: z.object({
    forest: Count,
    grain: Count,
    village: Count,
    track: Count,
    stream: Count,
  }),
  flags: z.object({ green: Count, yellow: Count, red: Count }),
  longest: z.object({ track: Count, stream: Count }),
  extras: ExtrasSchema,
  players: z.array(z.string().trim().min(1).max(40)).max(6).exactOptional(),
});
export type DorfromantikState = z.infer<typeof DorfromantikStateSchema>;

export const DorfromantikCampaignSchema = z
  .object({
    unlocked: z.array(UnlockIdSchema),
    redHearts: z.int().min(0).max(MAX_RED_HEARTS),
    unlockLog: z.array(z.object({ id: UnlockIdSchema, gameNumber: z.int().min(1) })),
    games: z.array(
      z.object({ sessionId: z.uuid(), gameNumber: z.int().min(1), total: z.int().min(0) }),
    ),
  })
  .refine((c) => new Set(c.unlocked).size === c.unlocked.length, {
    message: 'Each item is unlocked at most once.',
    path: ['unlocked'],
  })
  .refine((c) => c.unlocked.includes('DOR-U-REDHEART') === c.redHearts > 0, {
    message: 'Red Hearts is unlocked exactly when there is at least one heart.',
    path: ['redHearts'],
  });
export type DorfromantikCampaign = z.infer<typeof DorfromantikCampaignSchema>;
