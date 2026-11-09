import type { PatchworkBoard } from '@tablekeeper/core';

import { rotatedPositions, ROWS } from './board';
import { COLOR_FEATURES, FEATURES, type BoardSample, type CellSample } from './measure';
import type { BoardReferences, PatchworkReferences } from './references';

/**
 * Confidence reaches 1 once a space's distance is this many times past the threshold (or this
 * many times under it); right at the threshold it is 0.5.
 */
export const CONFIDENCE_BAND = 1.5;
/**
 * A space is glare when at least this share of its pixels are reflections (light and
 * unsaturated) and it is unusually smooth. White chocolate and gold pralines are light and
 * unsaturated too, but their printed art keeps them far from smooth.
 */
export const GLARE_SHARE = 0.4;
const GLARE_MAX_IQR_L = 8;
const GLARE_MAX_GRADIENT = 5;
const IQR_L = FEATURES.indexOf('iqrL');
const GRADIENT = FEATURES.indexOf('gradient');

export function isGlare(cell: CellSample): boolean {
  return (
    cell.glare >= GLARE_SHARE &&
    (cell.features[IQR_L] ?? Infinity) < GLARE_MAX_IQR_L &&
    (cell.features[GRADIENT] ?? Infinity) < GLARE_MAX_GRADIENT
  );
}
/** Glare spaces never get more than this, so they are always flagged for review. */
export const GLARE_CONFIDENCE = 0.4;

export type SpaceReading = {
  key: string;
  covered: boolean;
  confidence: number;
  /** Scaled distance to the nearest empty sample. */
  distance: number;
  glare: boolean;
};

/**
 * Distance from a space to the nearest of the board's empty samples at the positions it would
 * have if the board were turned 0°, 90°, 180° or 270° (D-016), so orientation is never needed.
 * Color features are first shifted by the difference between the reference's frame and this
 * photo's frame, which compensates for the light the photo was taken in.
 */
export function emptyDistance(
  cell: CellSample,
  row: number,
  col: number,
  frame: readonly number[],
  board: BoardReferences,
): number {
  let best = Infinity;
  for (const reference of board.references) {
    const shifted = cell.features.map((value, k) =>
      k < COLOR_FEATURES ? value + (reference.frame[k] as number) - (frame[k] as number) : value,
    );
    for (const [r, c] of rotatedPositions(row, col)) {
      const empty = reference.cells[r * ROWS + c] as number[];
      let sum = 0;
      shifted.forEach((value, k) => {
        sum += ((value - (empty[k] as number)) / (board.scale[k] as number)) ** 2;
      });
      best = Math.min(best, Math.sqrt(sum));
    }
  }
  return best;
}

/** 0.5 at the threshold, rising to 1 at `CONFIDENCE_BAND` times or a fraction of it. */
export function thresholdConfidence(distance: number, threshold: number): number {
  const margin = Math.abs(Math.log(Math.max(distance, 1e-6) / threshold));
  return 0.5 + 0.5 * Math.min(1, margin / Math.log(CONFIDENCE_BAND));
}

/** Every space read against one board's references. */
export function classifySpaces(
  sample: Pick<BoardSample, 'cells' | 'frame'>,
  board: BoardReferences,
): SpaceReading[] {
  return sample.cells.map((cell, index) => {
    const row = Math.floor(index / ROWS);
    const col = index % ROWS;
    const distance = emptyDistance(cell, row, col, sample.frame, board);
    const glare = isGlare(cell);
    const confidence = thresholdConfidence(distance, board.threshold);
    return {
      key: cell.key,
      covered: distance > board.threshold,
      confidence: glare ? Math.min(confidence, GLARE_CONFIDENCE) : confidence,
      distance,
      glare,
    };
  });
}

/** Red or gray from the frame's a*, with a confidence from how far it is from the midpoint. */
export function boardColor(
  frame: readonly number[],
  calibration: PatchworkReferences['frameRed'],
): { board: PatchworkBoard; confidence: number } {
  const offset = (frame[1] ?? 0) - calibration.midpoint;
  return {
    board: offset > 0 ? 'red' : 'gray',
    confidence: 0.5 + 0.5 * Math.min(1, Math.abs(offset) / calibration.halfGap),
  };
}
