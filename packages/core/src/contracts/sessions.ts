import { z } from 'zod';

import { isGameId } from '../games/registry';
import type {
  CellRef,
  DetectionMeta,
  GameId,
  ScoreBreakdown,
  Session,
  SessionSummary,
} from '../kit/types';

/**
 * A game id as sent by a client: the database's id pattern. Which games exist is the
 * registry's call, so an unknown id is `NOT_FOUND`, not `VALIDATION`.
 */
export const GameIdParamSchema = z.string().regex(/^[a-z_][a-z0-9_-]*$/, 'Not a game id.');

/** A game id in a server response: one the registry knows. */
export const KnownGameIdSchema = z.custom<GameId>(
  (value) => typeof value === 'string' && isGameId(value),
  'Unknown game.',
);

export const SessionStatusSchema = z.enum(['in_progress', 'completed']);

export const CellRefSchema: z.ZodType<CellRef> = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('square'), row: z.int(), col: z.int() }),
  z.object({ kind: z.literal('hex'), q: z.int(), r: z.int() }),
  z.object({ kind: z.literal('slot'), group: z.string(), index: z.int() }),
]);

export const ScoreBreakdownSchema: z.ZodType<ScoreBreakdown> = z.object({
  total: z.number(),
  categories: z.array(
    z.object({
      key: z.string(),
      label: z.string(),
      points: z.number(),
      highlights: z.array(CellRefSchema).exactOptional(),
      note: z.string().exactOptional(),
    }),
  ),
});

export const DetectionMetaSchema: z.ZodType<DetectionMeta> = z.object({
  corrected: z.array(z.string()).max(1000),
  detected: z.int().min(0),
});

const IsoDateSchema = z.iso.datetime({ offset: true });

export const SessionSchema: z.ZodType<Session> = z.object({
  id: z.uuid(),
  gameId: KnownGameIdSchema,
  status: SessionStatusSchema,
  state: z.unknown(),
  stateVersion: z.int().min(0),
  scoreTotal: z.number().nullable(),
  breakdown: ScoreBreakdownSchema.nullable(),
  detectionMeta: DetectionMetaSchema.nullable(),
  campaignId: z.uuid().nullable(),
  playedAt: IsoDateSchema,
});

export const SessionSummarySchema: z.ZodType<SessionSummary> = z.object({
  id: z.uuid(),
  gameId: KnownGameIdSchema,
  status: SessionStatusSchema,
  scoreTotal: z.number().nullable(),
  playedAt: IsoDateSchema,
});

/** `GET /v1/sessions` */
export const ListSessionsQuerySchema = z.object({
  gameId: GameIdParamSchema,
  cursor: z.string().max(200).optional(),
});
export type ListSessionsQuery = z.infer<typeof ListSessionsQuerySchema>;

export const SessionPageSchema = z.object({
  items: z.array(SessionSummarySchema),
  /** Pass as `cursor` for the next page; null on the last page. */
  nextCursor: z.string().nullable(),
  /** Over all the user's completed sessions of the game. */
  best: z.number().nullable(),
  average: z.number().nullable(),
});
export type SessionPage = z.infer<typeof SessionPageSchema>;

/** History pages hold this many sessions. */
export const SESSION_PAGE_SIZE = 20;

/**
 * `POST /v1/sessions`. Any score the client sends is dropped here (unknown keys are
 * stripped); the server recomputes it from `state`.
 */
export const SaveSessionRequestSchema = z.object({
  gameId: GameIdParamSchema,
  status: SessionStatusSchema,
  state: z.unknown(),
  stateVersion: z.int().min(0),
  detectionMeta: DetectionMetaSchema.optional(),
  campaignId: z.uuid().optional(),
  playedAt: IsoDateSchema.optional(),
});
export type SaveSessionRequest = z.infer<typeof SaveSessionRequestSchema>;

export const SessionIdParamsSchema = z.object({ id: z.uuid() });

/** `PATCH /v1/sessions/:id`. A new `state` needs its `stateVersion`. */
export const PatchSessionRequestSchema = z
  .object({
    status: SessionStatusSchema.optional(),
    state: z.unknown().optional(),
    stateVersion: z.int().min(0).optional(),
    detectionMeta: DetectionMetaSchema.optional(),
  })
  .refine((body) => (body.state === undefined) === (body.stateVersion === undefined), {
    message: 'Send state and stateVersion together.',
    path: ['stateVersion'],
  })
  .refine((body) => Object.values(body).some((value) => value !== undefined), {
    message: 'Nothing to update.',
  });
export type PatchSessionRequest = z.infer<typeof PatchSessionRequestSchema>;
