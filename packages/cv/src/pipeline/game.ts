import type { Detector, Draft, ImageInput, Quad } from '@tablekeeper/core';
import type { z } from 'zod';

import {
  measureBoard,
  runBoardPipeline,
  type BoardReading,
  type CellMeasure,
  type GridBoard,
  type PipelineOptions,
} from './board-pipeline';
import type { Profile } from './profile';

/**
 * What each `packages/cv/src/games/<gameId>/index.ts` exports as `cvGame`: the detector the worker
 * runs, and what `pnpm eval:cv` needs to measure and calibrate it.
 */
export interface CvGame<State = unknown, Label = unknown> {
  detector: Detector<State>;
  /** The `label` of one item in `data/fixtures/<gameId>/labels.json`. */
  labelSchema: z.ZodType<Label>;
  /** The true class of every cell, by confidence key. */
  cellTruth(label: Label): Record<string, string>;
  /** Reads the board with the committed profile. */
  read(image: ImageInput, opts?: PipelineOptions): Promise<BoardReading>;
  /** Cell features with the board at known corners, for calibration. */
  measure(image: ImageInput, corners: Quad, opts?: PipelineOptions): Promise<CellMeasure[]>;
  features: Profile['features'];
  /** The same game with another profile (the eval checks a fresh calibration with it). */
  withProfile(profile: Profile): CvGame<State, Label>;
}

/**
 * A grid board game: the board, its profile, a function from cell labels to state, and how to
 * read a fixture label.
 */
export function createGridGame<State, Label>(opts: {
  board: GridBoard;
  profile: Profile;
  toState: (labels: Record<string, string>) => State;
  labelSchema: z.ZodType<Label>;
  cellTruth: (label: Label) => Record<string, string>;
}): CvGame<State, Label> {
  const read = (image: ImageInput, pipelineOpts?: PipelineOptions) =>
    runBoardPipeline(image, opts.board, opts.profile, pipelineOpts);
  return {
    labelSchema: opts.labelSchema,
    cellTruth: opts.cellTruth,
    features: opts.board.features,
    read,
    withProfile: (profile) => createGridGame({ ...opts, profile }),
    async measure(image, corners, pipelineOpts) {
      const measured = await measureBoard(image, opts.board, { ...pipelineOpts, corners });
      return measured.cells;
    },
    detector: {
      async detect(image, detectOpts): Promise<Draft<State>> {
        const reading = await read(image, detectOpts);
        return {
          state: opts.toState(Object.fromEntries(reading.cells.map((c) => [c.key, c.label]))),
          confidence: Object.fromEntries(reading.cells.map((c) => [c.key, round(c.confidence)])),
          corners: reading.corners,
          warnings: reading.warnings,
        };
      },
    },
  };
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
