import { z } from 'zod';

import { hexKeys } from '../../kit/hex-grid';

import { HARMONIES_LAYOUTS } from './layout';
import { isValidStack, HarmoniesPieceSchema, stackCode } from './stacks';

const CardSchema = z.object({ points: z.int().min(0).max(999) });

const SPACES = { A: hexKeys(HARMONIES_LAYOUTS.A), B: hexKeys(HARMONIES_LAYOUTS.B) };

/** docs/games/harmonies.md → State. A missing key is an empty space. */
export const HarmoniesStateSchema = z
  .object({
    side: z.enum(['A', 'B']),
    stacks: z.record(z.string(), z.array(HarmoniesPieceSchema)),
    animalCards: z.array(CardSchema),
    spiritCards: z.array(CardSchema).optional(),
  })
  .superRefine((state, ctx) => {
    for (const [key, stack] of Object.entries(state.stacks)) {
      if (!SPACES[state.side].has(key)) {
        ctx.addIssue({
          code: 'custom',
          path: ['stacks', key],
          message: `${key} isn't a space on side ${state.side}.`,
        });
      } else if (!isValidStack(stack)) {
        ctx.addIssue({
          code: 'custom',
          path: ['stacks', key],
          message: `${stackCode(stack) || 'An empty stack'} isn't a valid stack.`,
        });
      }
    }
  });

export type HarmoniesState = z.infer<typeof HarmoniesStateSchema>;

export function emptyHarmoniesState(side: HarmoniesState['side'] = 'A'): HarmoniesState {
  return { side, stacks: {}, animalCards: [] };
}
