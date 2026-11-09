import type { ImageInput, Quad } from '@tablekeeper/core';

import { sampleCells, type CellRegion } from '../../pipeline/cells';
import { rgbToLab } from '../../pipeline/features';
import { BOARD_NOT_FOUND } from '../../pipeline/find-board';
import { centeredQuad, scaleQuad } from '../../pipeline/geometry';
import { loadImage } from '../../pipeline/load-image';
import type { Mat } from '../../pipeline/opencv';
import { warpToCanonical } from '../../pipeline/warp';

import { CELL_INSET, frameBand, PATCHWORK_LAYOUT, SIZE } from './board';
import { findBoxBoard } from './find-box-board';

/**
 * What each space is compared on. Medians and interquartile ranges rather than means and standard
 * deviations, so a neighbor's banderole or shadow reaching into a corner of the space doesn't move
 * them; raw LAB rather than `normalizeLighting`, whose gray-world white balance pulls the red board
 * to neutral. `gradient` is the 75th percentile of the lightness gradient: printed praline art
 * has edges, an empty space has almost none.
 */
export const FEATURES = ['L', 'a', 'b', 'iqrL', 'iqrA', 'iqrB', 'gradient'] as const;
export type PatchworkFeature = (typeof FEATURES)[number];
/** The color features, which are shifted by the frame's color to compensate for lighting. */
export const COLOR_FEATURES = 3;

/**
 * A pixel may be a reflection when it is unsaturated and this much lighter than the frame. The gray
 * board is itself light and unsaturated, so lightness alone can't tell; its empty spaces sit about
 * 15 above the frame, reflections 30 or more.
 */
const GLARE_ABOVE_FRAME = 28;
const GLARE_CHROMA = 12;

export type CellSample = {
  key: string;
  /** In `FEATURES` order. */
  features: number[];
  /** Share of the space's pixels that look like a reflection, 0 to 1. */
  glare: number;
};

export type BoardSample = {
  /** In original image pixels, TL, TR, BR, BL. */
  corners: Quad;
  /** False when the corners are the centered fallback. */
  found: boolean;
  /** How well the board's sides line up with straight edges, 0 to 1 (1 for given corners). */
  boardConfidence: number;
  cells: CellSample[];
  /** Median LAB of the frame band, reflections left out. */
  frame: [number, number, number];
  warnings: string[];
};

export type MeasureOptions = {
  corners?: Quad;
  /** EXIF orientation still to apply (Node only). */
  orientation?: number;
  /** Called once the board is found, before the spaces are measured. */
  onFound?: () => void;
};

/** Finds (or takes) the board, warps it, and measures every space and the frame. */
export function measureBoxBoard(image: ImageInput, opts: MeasureOptions = {}): BoardSample {
  const loaded = loadImage(image, {
    maxSide: 1600,
    ...(opts.orientation === undefined ? {} : { orientation: opts.orientation }),
  });
  try {
    const warnings: string[] = [];
    let quad: Quad;
    let found = true;
    let boardConfidence = 1;
    if (opts.corners) {
      quad = scaleQuad(opts.corners, loaded.scale);
    } else {
      const box = findBoxBoard(loaded.mat);
      if (box) {
        quad = box.quad;
        boardConfidence = box.confidence;
      } else {
        quad = centeredQuad(loaded.mat.cols, loaded.mat.rows);
        found = false;
        boardConfidence = 0;
        warnings.push(BOARD_NOT_FOUND);
      }
    }
    opts.onFound?.();
    const warped = warpToCanonical(loaded.mat, quad, { width: SIZE, height: SIZE });
    try {
      const frame = frameColor(warped);
      const cells = sampleCells(warped, PATCHWORK_LAYOUT, { inset: CELL_INSET }).map((region) =>
        measureCell(region, frame[0] + GLARE_ABOVE_FRAME),
      );
      return {
        corners: scaleQuad(quad, 1 / loaded.scale),
        found,
        boardConfidence,
        cells,
        frame,
        warnings,
      };
    } finally {
      warped.delete();
    }
  } finally {
    loaded.mat.delete();
  }
}

/** Gradient (on lightness, 0 to 100) is measured over this many pixels each way. */
const GRADIENT_STEP = 1;

function measureCell(region: CellRegion, glareL: number): CellSample {
  const { width, height, mask } = region;
  const lab = regionLab(region);
  const L: number[] = [];
  const a: number[] = [];
  const b: number[] = [];
  const gradients: number[] = [];
  let glare = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (!mask[i]) continue;
      const l = lab[i * 3] as number;
      const pa = lab[i * 3 + 1] as number;
      const pb = lab[i * 3 + 2] as number;
      L.push(l);
      a.push(pa);
      b.push(pb);
      if (l > glareL && Math.hypot(pa, pb) < GLARE_CHROMA) glare++;
      const s = GRADIENT_STEP;
      if (x < s || y < s || x >= width - s || y >= height - s) continue;
      const gx = (lab[(i + s) * 3] as number) - (lab[(i - s) * 3] as number);
      const gy = (lab[(i + s * width) * 3] as number) - (lab[(i - s * width) * 3] as number);
      gradients.push(Math.hypot(gx, gy) / (2 * s));
    }
  }
  [L, a, b, gradients].forEach((values) => values.sort((p, q) => p - q));
  return {
    key: region.key,
    features: [
      quantile(L, 0.5),
      quantile(a, 0.5),
      quantile(b, 0.5),
      iqr(L),
      iqr(a),
      iqr(b),
      quantile(gradients, 0.75),
    ],
    glare: L.length ? glare / L.length : 0,
  };
}

function regionLab(region: CellRegion): Float32Array {
  const n = region.width * region.height;
  const lab = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const [L, a, b] = rgbToLab(
      region.rgb[i * 3] as number,
      region.rgb[i * 3 + 1] as number,
      region.rgb[i * 3 + 2] as number,
    );
    lab[i * 3] = L;
    lab[i * 3 + 1] = a;
    lab[i * 3 + 2] = b;
  }
  return lab;
}

/** Median LAB of the frame band, leaving out unsaturated highlights on its bevel. */
function frameColor(warped: Mat): [number, number, number] {
  const regions = sampleCells(
    warped,
    { cells: frameBand().map((polygon, i) => ({ key: `frame${i}`, polygon })) },
    { inset: 0 },
  );
  const channels: [number[], number[], number[]] = [[], [], []];
  for (const region of regions) {
    const lab = regionLab(region);
    for (let i = 0; i < region.mask.length; i++) {
      if (!region.mask[i]) continue;
      const L = lab[i * 3] as number;
      const a = lab[i * 3 + 1] as number;
      const b = lab[i * 3 + 2] as number;
      if (L > 80 && Math.hypot(a, b) < GLARE_CHROMA) continue;
      channels[0].push(L);
      channels[1].push(a);
      channels[2].push(b);
    }
  }
  channels.forEach((values) => values.sort((p, q) => p - q));
  return [quantile(channels[0], 0.5), quantile(channels[1], 0.5), quantile(channels[2], 0.5)];
}

/** The `p` quantile of sorted values (0 when empty). */
function quantile(sorted: readonly number[], p: number): number {
  if (!sorted.length) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] as number;
}

function iqr(sorted: readonly number[]): number {
  return quantile(sorted, 0.75) - quantile(sorted, 0.25);
}
