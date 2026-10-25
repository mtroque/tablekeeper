import { z } from 'zod';

import type { GameDefinition } from '../kit/types';

export const GameIdSchema = z.enum(['patchwork', 'azul', 'harmonies', 'dorfromantik']);

export const GameSummarySchema = z.object({
  id: GameIdSchema,
  name: z.string(),
  edition: z.string(),
  rulebookUrl: z.url(),
  features: z.object({
    rules: z.boolean(),
    scorer: z.boolean(),
    campaign: z.boolean(),
    photo: z.boolean(),
  }),
  rulesStarters: z.array(z.string()),
});
export type GameSummary = z.infer<typeof GameSummarySchema>;

export const GamesResponseSchema = z.object({ games: z.array(GameSummarySchema) });
export type GamesResponse = z.infer<typeof GamesResponseSchema>;

export function toGameSummary(game: GameDefinition): GameSummary {
  return {
    id: game.id,
    name: game.name,
    edition: game.edition,
    rulebookUrl: game.rulebook.publisherUrl,
    features: { ...game.features },
    rulesStarters: [...game.rulesStarters],
  };
}
