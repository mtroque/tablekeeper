import type { ImageInput, PatchworkBoard, Quad } from '@tablekeeper/core';

import { loadOpenCv } from '../../pipeline/opencv';

import { ROWS } from './board';
import { emptyDistance } from './classify';
import { FEATURES, measureBoxBoard, type BoardSample } from './measure';
import { BOARDS, type BoardReferences, type PatchworkReferences } from './references';

/** Spreads below this are raised to it, so a feature that barely varies doesn't dominate. */
const MIN_SCALE = 0.5;
/** Empty reference photos: `empty-red-1.jpg` and so on (docs/DATA_ASSETS.md → References). */
const REFERENCE_NAME = /(?:^|\/)empty-(red|gray)-\d+\.jpe?g$/;

export type CalibrationImage = { name: string; image: ImageInput; orientation?: number };
export type LabeledImage = CalibrationImage & {
  corners?: Quad;
  board: PatchworkBoard;
  /** Row-major, true = covered. */
  grid: boolean[];
};

export type ReferenceSample = { name: string; board: PatchworkBoard; sample: BoardSample };
/** A labeled photo measured once or more (at its labeled corners and at the found ones). */
export type LabeledSample = { board: PatchworkBoard; grid: boolean[]; samples: BoardSample[] };

/**
 * Measures the empty references (found by the board finder) and each labeled photo at its
 * labeled corners and at the corners the finder picks, then builds the calibration from them.
 */
export async function calibratePatchwork(input: {
  references: CalibrationImage[];
  items: LabeledImage[];
}): Promise<{ references: PatchworkReferences; summary: string[] }> {
  await loadOpenCv();
  const references: ReferenceSample[] = [];
  for (const ref of input.references) {
    const board = REFERENCE_NAME.exec(ref.name)?.[1] as PatchworkBoard | undefined;
    if (!board) continue;
    const sample = measureBoxBoard(ref.image, orientation(ref));
    if (!sample.found) throw new Error(`No board found in the reference ${ref.name}`);
    references.push({ name: ref.name, board, sample });
  }
  const items: LabeledSample[] = input.items.map((item) => ({
    board: item.board,
    grid: item.grid,
    samples: [
      measureBoxBoard(item.image, orientation(item)),
      ...(item.corners
        ? [measureBoxBoard(item.image, { ...orientation(item), corners: item.corners })]
        : []),
    ],
  }));
  return buildReferences(references, items);
}

function orientation(image: CalibrationImage): { orientation?: number } {
  return image.orientation === undefined ? {} : { orientation: image.orientation };
}

/** The calibration from measured samples (pure, so it is tested without photos). */
export function buildReferences(
  references: ReferenceSample[],
  items: LabeledSample[],
): { references: PatchworkReferences; summary: string[] } {
  const summary: string[] = [];
  const boards = {} as Record<PatchworkBoard, BoardReferences>;
  for (const board of BOARDS) {
    const own = references.filter((ref) => ref.board === board);
    if (!own.length) throw new Error(`No empty references for the ${board} board`);
    const partial: BoardReferences = {
      references: own.map(({ name, sample }) => ({
        name,
        frame: sample.frame,
        cells: sample.cells.map((cell) => cell.features),
      })),
      scale: featureScale(own.flatMap(({ sample }) => sample.cells.map((cell) => cell.features))),
      threshold: 1,
    };
    const distances = items
      .filter((item) => item.board === board)
      .flatMap((item) =>
        item.samples.flatMap((sample) =>
          sample.cells.map((cell, index) => ({
            distance: emptyDistance(
              cell,
              Math.floor(index / ROWS),
              index % ROWS,
              sample.frame,
              partial,
            ),
            covered: item.grid[index] === true,
          })),
        ),
      );
    const { threshold, errors } = bestThreshold(distances);
    boards[board] = { ...partial, threshold };
    summary.push(
      `${board}: ${own.length} references, threshold ${threshold.toFixed(2)}, ${errors} of ${distances.length} measured spaces on the wrong side`,
    );
  }

  const frames = [
    ...references.map(({ board, sample }) => ({ board, a: sample.frame[1] })),
    ...items.flatMap((item) => item.samples.map((s) => ({ board: item.board, a: s.frame[1] }))),
  ];
  const lowestRed = Math.min(...frames.filter((f) => f.board === 'red').map((f) => f.a));
  const highestGray = Math.max(...frames.filter((f) => f.board === 'gray').map((f) => f.a));
  const frameRed = {
    midpoint: round((lowestRed + highestGray) / 2),
    halfGap: round(Math.max(1, (lowestRed - highestGray) / 2)),
  };
  summary.push(
    `frame a*: gray up to ${highestGray.toFixed(1)}, red from ${lowestRed.toFixed(1)}, midpoint ${frameRed.midpoint}`,
  );

  return {
    references: {
      version: 1,
      features: [...FEATURES],
      boards: {
        red: roundBoard(boards.red),
        gray: roundBoard(boards.gray),
      },
      frameRed,
    },
    summary,
  };
}

/** Each feature's standard deviation, at least `MIN_SCALE`. */
export function featureScale(vectors: number[][]): number[] {
  return FEATURES.map((_, k) => {
    const values = vectors.map((v) => v[k] as number);
    const mean = values.reduce((s, v) => s + v, 0) / Math.max(1, values.length);
    const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / Math.max(1, values.length);
    return round(Math.max(MIN_SCALE, Math.sqrt(variance)));
  });
}

/**
 * The split between empty (near) and covered (far) spaces with the fewest on the wrong side,
 * placed at the geometric middle of the gap; among equal splits, the widest gap wins.
 */
export function bestThreshold(samples: Array<{ distance: number; covered: boolean }>): {
  threshold: number;
  errors: number;
} {
  const sorted = [...samples].sort((p, q) => p.distance - q.distance);
  const totalCovered = sorted.filter((s) => s.covered).length;
  let best = { threshold: 1, errors: Infinity, gap: -Infinity };
  // Splitting after index i: everything up to i reads empty, everything after it covered.
  let coveredBelow = 0;
  for (let i = 0; i < sorted.length - 1; i++) {
    const here = sorted[i] as { distance: number; covered: boolean };
    const next = sorted[i + 1] as { distance: number; covered: boolean };
    if (here.covered) coveredBelow++;
    const emptyAbove = sorted.length - (i + 1) - (totalCovered - coveredBelow);
    const wrong = coveredBelow + emptyAbove;
    const low = Math.max(here.distance, 1e-6);
    const high = Math.max(next.distance, 1e-6);
    const gap = Math.log(high / low);
    if (wrong < best.errors || (wrong === best.errors && gap > best.gap)) {
      best = { threshold: Math.sqrt(low * high), errors: wrong, gap };
    }
  }
  if (best.errors === Infinity) throw new Error('A threshold needs at least 2 measured spaces');
  return { threshold: round(best.threshold), errors: best.errors };
}

function roundBoard(board: BoardReferences): BoardReferences {
  return {
    ...board,
    references: board.references.map((ref) => ({
      name: ref.name,
      frame: ref.frame.map(round) as [number, number, number],
      cells: ref.cells.map((cell) => cell.map(round)),
    })),
  };
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
