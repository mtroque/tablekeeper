import type { Point, Quad } from '@tablekeeper/core';

import { BOARD_NOT_FOUND } from '../../pipeline/find-board';
import { centeredQuad } from '../../pipeline/geometry';
import { getCv, type Mat } from '../../pipeline/opencv';

import { BOARD_ASPECT } from './layout';
import { edgeField, fitOutline, searchOutline } from './outline-fit';

export { BOARD_NOT_FOUND };

export type HarmoniesBoard = {
  /**
   * The board rectangle's corners (docs/games/harmonies.md → Board rectangle), TL, TR, BR, BL in
   * the board's own orientation, in the input's pixels.
   */
  corners: Quad;
  found: boolean;
  /** 0 to 1. */
  confidence: number;
};

/** Longest side the outline is searched at; corners are scaled back to the input. */
const SEARCH_SIDE = 800;

/** Fit scores (share of the outline on matching edges) from "surely not" to "surely the board". */
const SCORE_FLOOR = 0.6;
const SCORE_SURE = 0.9;

/**
 * Finds the board rectangle in an RGB Mat. The bottom of the board is curved, so this doesn't
 * look for a 4-gon (`findBoardQuad`): it fits the board's whole outline (straight top, straight
 * upper sides, the bottom curve) to the photo's edges, searching every position, size and
 * quarter turn coarsely and then refining the best few (`outline-fit.ts`). Falls back to a
 * centered rectangle.
 */
export function findHarmoniesBoard(mat: Mat): HarmoniesBoard {
  const cv = getCv();
  const scale = Math.min(1, SEARCH_SIDE / Math.max(mat.cols, mat.rows));
  const small = new cv.Mat();
  const gray = new cv.Mat();
  const edges = new cv.Mat();
  try {
    cv.resize(
      mat,
      small,
      new cv.Size(Math.round(mat.cols * scale), Math.round(mat.rows * scale)),
      0,
      0,
      cv.INTER_AREA,
    );
    cv.cvtColor(small, gray, cv.COLOR_RGB2GRAY);
    cv.GaussianBlur(gray, gray, new cv.Size(5, 5), 0);
    // Low thresholds: on a wooden table the board's edge is faint; the fit ignores the clutter.
    cv.Canny(gray, edges, 15, 40);
    const field = edgeField(gray.data, edges.data, gray.cols, gray.rows);
    let best: { quad: Quad; score: number } | undefined;
    for (const start of searchOutline(field, BOARD_ASPECT)) {
      const fit = fitOutline(field, start);
      if (!best || fit.score > best.score) best = fit;
    }
    const confidence = best ? clamp01((best.score - SCORE_FLOOR) / (SCORE_SURE - SCORE_FLOOR)) : 0;
    if (!best || confidence === 0) {
      return {
        corners: centeredQuad(mat.cols, mat.rows),
        found: false,
        confidence: 0,
      };
    }
    return { corners: scaleCorners(best.quad, 1 / scale), found: true, confidence };
  } finally {
    small.delete();
    gray.delete();
    edges.delete();
  }
}

function scaleCorners(quad: Quad, factor: number): Quad {
  const s = (p: Point): Point => ({ x: p.x * factor, y: p.y * factor });
  return [s(quad[0]), s(quad[1]), s(quad[2]), s(quad[3])];
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
