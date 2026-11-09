import type { PatchworkBoard } from '@tablekeeper/core';
import { z } from 'zod';

import { FEATURES } from './measure';

/** cv imports only types from core, so the boards are listed here and checked against its type. */
export const BOARDS = ['red', 'gray'] as const satisfies readonly PatchworkBoard[];

const Lab = z.tuple([z.number(), z.number(), z.number()]);
const Vector = z.array(z.number()).length(FEATURES.length);

/** One empty board photographed: its frame color and every space's features, row by row. */
const ReferenceSchema = z.object({
  name: z.string(),
  frame: Lab,
  cells: z.array(Vector).length(81),
});

const BoardReferencesSchema = z.object({
  references: z.array(ReferenceSchema).min(1),
  /** Each feature's spread across this board's empty spaces; distances are in these units. */
  scale: z.array(z.number().positive()).length(FEATURES.length),
  /** Distance from the nearest empty sample above which a space is covered. */
  threshold: z.number().positive(),
});

/**
 * Patchwork's calibration (`references.json`): the empty references of each board and the
 * thresholds learned from the labeled fixtures (docs/games/patchwork.md → Photo reading).
 */
export const PatchworkReferencesSchema = z.object({
  version: z.literal(1),
  features: z
    .array(z.string())
    .refine((names) => names.join() === FEATURES.join(), 'Built for other features; recalibrate'),
  boards: z.object({ red: BoardReferencesSchema, gray: BoardReferencesSchema }),
  /** The frame's a* (red to green) halfway between the gray and the red board, and half the gap. */
  frameRed: z.object({ midpoint: z.number(), halfGap: z.number().positive() }),
});
export type PatchworkReferences = z.infer<typeof PatchworkReferencesSchema>;
export type BoardReferences = z.infer<typeof BoardReferencesSchema>;
