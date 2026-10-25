import { z } from 'zod';

const PointSchema = z.tuple([z.number(), z.number()]);

/** `data/fixtures/<gameId>/labels.json` (docs/DATA_ASSETS.md → labels.json format). */
export const FixtureSetSchema = z.object({
  gameId: z.string(),
  accuracyThreshold: z.number().min(0).max(1),
  items: z
    .array(
      z.object({
        image: z.string(),
        corners: z.tuple([PointSchema, PointSchema, PointSchema, PointSchema]).optional(),
        label: z.unknown(),
      }),
    )
    .min(1),
});
export type FixtureSet = z.infer<typeof FixtureSetSchema>;
