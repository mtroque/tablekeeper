import type { DetectOptions, ImageInput, Quad } from '@tablekeeper/core';

import { sampleCells, type BoardLayout } from './cells';
import { cellFeatures, featureVector } from './features';
import { BOARD_NOT_FOUND, findBoardQuad } from './find-board';
import { scaleQuad } from './geometry';
import { loadImage } from './load-image';
import { normalizeLighting } from './normalize';
import { isOpenCvLoaded, loadOpenCv } from './opencv';
import { classifyNearest, type Profile } from './profile';
import { warpToCanonical, type CanonicalSize } from './warp';

/** Everything a grid board needs besides its profile. */
export type GridBoard = {
  layout: BoardLayout;
  canonical: CanonicalSize;
  /** The board's long side over its short side. */
  aspect: { min: number; max: number };
  /** Features the profile is built on. */
  features: Profile['features'];
  /** Share of each cell skipped at its edges. */
  inset?: number;
  minAreaRatio?: number;
  maxSide?: number;
};

export type PipelineOptions = DetectOptions & {
  /** EXIF orientation still to apply (Node only; browsers apply it when decoding). */
  orientation?: number;
};

export type CellMeasure = { key: string; features: number[] };
export type CellReading = CellMeasure & { label: string; confidence: number };

export type BoardMeasure = {
  /** In original image pixels, TL, TR, BR, BL. */
  corners: Quad;
  /** False when the corners are the centered fallback. */
  boardFound: boolean;
  boardConfidence: number;
  cells: CellMeasure[];
  warnings: string[];
};

export type BoardReading = Omit<BoardMeasure, 'cells'> & { cells: CellReading[] };

/**
 * Load → find board (skipped when corners are given) → warp → normalize → sample → features. Every
 * Mat it creates is deleted before it returns.
 */
export async function measureBoard(
  image: ImageInput,
  board: GridBoard,
  opts: PipelineOptions = {},
): Promise<BoardMeasure> {
  if (!isOpenCvLoaded()) opts.onProgress?.('loading-opencv');
  await loadOpenCv();
  throwIfAborted(opts.signal);

  const loaded = loadImage(image, {
    maxSide: board.maxSide ?? 1600,
    ...(opts.orientation === undefined ? {} : { orientation: opts.orientation }),
  });
  try {
    const warnings: string[] = [];
    let quad: Quad;
    let boardFound = true;
    let boardConfidence = 1;
    if (opts.corners) {
      quad = scaleQuad(opts.corners, loaded.scale);
    } else {
      opts.onProgress?.('finding-board');
      const found = findBoardQuad(loaded.mat, {
        aspect: board.aspect,
        ...(board.minAreaRatio === undefined ? {} : { minAreaRatio: board.minAreaRatio }),
      });
      quad = found.quad;
      boardFound = found.found;
      boardConfidence = found.confidence;
      if (!found.found) warnings.push(BOARD_NOT_FOUND);
    }
    throwIfAborted(opts.signal);

    opts.onProgress?.('classifying');
    const warped = warpToCanonical(loaded.mat, quad, board.canonical);
    const normalized = normalizeLighting(warped);
    warped.delete();
    const regions = sampleCells(normalized, board.layout, {
      ...(board.inset === undefined ? {} : { inset: board.inset }),
    });
    normalized.delete();
    const cells = regions.map((region) => ({
      key: region.key,
      features: featureVector(cellFeatures(region), board.features),
    }));
    return {
      corners: scaleQuad(quad, 1 / loaded.scale),
      boardFound,
      boardConfidence,
      cells,
      warnings,
    };
  } finally {
    loaded.mat.delete();
  }
}

/** `measureBoard`, then each cell classified against the profile. */
export async function runBoardPipeline(
  image: ImageInput,
  board: GridBoard,
  profile: Profile,
  opts: PipelineOptions = {},
): Promise<BoardReading> {
  const measured = await measureBoard(image, board, opts);
  return {
    ...measured,
    cells: measured.cells.map((cell) => {
      const { label, confidence } = classifyNearest(cell.features, profile);
      return { ...cell, label, confidence };
    }),
  };
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw new Error('Detection was aborted');
}
