import { z } from 'zod';

import { createGridGame } from '../../pipeline/game';
import { ProfileSchema } from '../../pipeline/profile';

import { exampleBoard } from './board';
import profileJson from './profile.json';

/** The S1 example game's state: 9 spaces row by row from the top left, `true` covered. */
export type ExampleState = { cells: boolean[] };

/** A fixture label: rows top to bottom, `#` covered, `.` empty (like Patchwork's grid). */
export const ExampleLabelSchema = z.object({
  grid: z.array(z.string().regex(/^[#.]{3}$/)).length(3),
});
export type ExampleLabel = z.infer<typeof ExampleLabelSchema>;

const COVERED = 'covered';
const EMPTY = 'empty';

export const cvGame = createGridGame<ExampleState, ExampleLabel>({
  board: exampleBoard,
  profile: ProfileSchema.parse(profileJson),
  toState: (labels) => ({
    cells: [0, 1, 2].flatMap((row) => [0, 1, 2].map((col) => labels[`${row},${col}`] === COVERED)),
  }),
  labelSchema: ExampleLabelSchema,
  cellTruth: (label) =>
    Object.fromEntries(
      label.grid.flatMap((line, row) =>
        [0, 1, 2].map((col) => [`${row},${col}`, line.charAt(col) === '#' ? COVERED : EMPTY]),
      ),
    ),
});

export const detector = cvGame.detector;
