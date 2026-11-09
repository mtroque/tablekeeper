import type {
  ConfidenceMap,
  DetectOptions,
  Detector,
  Draft,
  HarmoniesSide,
  HarmoniesState,
  ImageInput,
  Quad,
} from '@tablekeeper/core';
import { z } from 'zod';

import type {
  BoardReading as PipelineReading,
  PipelineOptions,
} from '../../pipeline/board-pipeline';
import { BOARD_NOT_FOUND } from '../../pipeline/find-board';
import type { CvGame } from '../../pipeline/game';
import { scaleQuad } from '../../pipeline/geometry';
import { loadImage } from '../../pipeline/load-image';
import { isOpenCvLoaded, loadOpenCv } from '../../pipeline/opencv';
import { ProfileSchema, type Profile } from '../../pipeline/profile';

import { findHarmoniesBoard } from './board';
import { draftFromReading } from './draft';
import type { Pixels } from './geometry';
import { PieceSchema, SPACES as SIDE_SPACES } from './layout';
import profileJson from './profile.json';
import { EMPTY, measureBoard, OCCLUDED, readBoard, type BoardReading } from './read';

export { findHarmoniesBoard } from './board';
export { draftFromReading, heightKey, SIDE_KEY } from './draft';
export { measureBoard, readBoard, detectSide, EMPTY, OCCLUDED } from './read';
export { BOARD_ASPECT, GRID, SPACES as HARMONIES_CV_SPACES } from './layout';

const SPACES = {
  A: new Set(SIDE_SPACES.A.map((s) => s.key)),
  B: new Set(SIDE_SPACES.B.map((s) => s.key)),
};

/** A fixture label (docs/DATA_ASSETS.md → labels.json format, Harmonies). */
export const HarmoniesLabelSchema = z
  .object({
    side: z.enum(['A', 'B']),
    tops: z.record(z.string(), PieceSchema),
    stacks: z.record(z.string(), z.string()).optional(),
    cubes: z.array(z.string()).optional(),
    occluded: z.array(z.string()),
  })
  .superRefine((label, ctx) => {
    const keys = [
      ...Object.keys(label.tops),
      ...Object.keys(label.stacks ?? {}),
      ...(label.cubes ?? []),
      ...label.occluded,
    ];
    for (const key of keys) {
      if (!SPACES[label.side].has(key)) {
        ctx.addIssue({ code: 'custom', message: `${key} isn't a space on side ${label.side}.` });
      }
    }
  });
export type HarmoniesLabel = z.infer<typeof HarmoniesLabelSchema>;

/** The eval's pseudo-cell for the board side, so its confusion matrix shows side errors. */
const SIDE_CELL = 'side';

/** The pixels to read and the board corners in them. */
type Located = {
  pixels: Pixels;
  corners: Quad;
  /** Located pixels over original pixels. */
  scale: number;
  found: boolean;
  confidence: number;
  release: () => void;
};

/**
 * Finds the board unless corners are given. With corners and no orientation to apply, the photo
 * is read as it is, without opencv.
 */
async function locate(image: ImageInput, opts: PipelineOptions): Promise<Located> {
  const orientation = opts.orientation ?? 1;
  if (opts.corners && orientation === 1) {
    return {
      pixels: { data: image.data, width: image.width, height: image.height, channels: 4 },
      corners: opts.corners,
      scale: 1,
      found: true,
      confidence: 1,
      release: () => undefined,
    };
  }
  if (!isOpenCvLoaded()) opts.onProgress?.('loading-opencv');
  await loadOpenCv();
  throwIfAborted(opts.signal);
  const loaded = loadImage(image, { maxSide: 1600, orientation });
  const pixels: Pixels = {
    data: loaded.mat.data,
    width: loaded.mat.cols,
    height: loaded.mat.rows,
    channels: 3,
  };
  const release = () => {
    loaded.mat.delete();
  };
  if (opts.corners) {
    return {
      pixels,
      corners: scaleQuad(opts.corners, loaded.scale),
      scale: loaded.scale,
      found: true,
      confidence: 1,
      release,
    };
  }
  opts.onProgress?.('finding-board');
  try {
    const board = findHarmoniesBoard(loaded.mat);
    return { pixels, ...board, scale: loaded.scale, release };
  } catch (error) {
    release();
    throw error;
  }
}

type Reading = BoardReading & {
  corners: Quad;
  boardFound: boolean;
  boardConfidence: number;
  warnings: string[];
};

async function readPhoto(
  image: ImageInput,
  profile: Profile,
  opts: PipelineOptions,
): Promise<Reading> {
  const located = await locate(image, opts);
  try {
    throwIfAborted(opts.signal);
    opts.onProgress?.('classifying');
    const reading = readBoard(located.pixels, located.corners, profile);
    return {
      ...reading,
      corners: scaleQuad(located.corners, 1 / located.scale),
      boardFound: located.found,
      boardConfidence: located.confidence,
      warnings: located.found ? [] : [BOARD_NOT_FOUND],
    };
  } finally {
    located.release();
  }
}

function createGame(profile: Profile): CvGame<HarmoniesState, HarmoniesLabel> {
  const detector: Detector<HarmoniesState> = {
    async detect(image: ImageInput, opts?: DetectOptions): Promise<Draft<HarmoniesState>> {
      const reading = await readPhoto(image, profile, opts ?? {});
      return { ...draftFromReading(reading), corners: reading.corners, warnings: reading.warnings };
    },
  };
  return {
    detector,
    labelSchema: HarmoniesLabelSchema,
    cellTruth: (label) => ({
      [SIDE_CELL]: label.side,
      ...Object.fromEntries(
        [...SPACES[label.side]].map((key) => [
          key,
          label.tops[key] ?? (label.occluded.includes(key) ? OCCLUDED : EMPTY),
        ]),
      ),
    }),
    async read(image, opts): Promise<PipelineReading> {
      const reading = await readPhoto(image, profile, opts ?? {});
      return {
        corners: reading.corners,
        boardFound: reading.boardFound,
        boardConfidence: reading.boardConfidence,
        warnings: reading.warnings,
        cells: [
          {
            key: SIDE_CELL,
            label: reading.side,
            confidence: reading.sideConfidence,
            features: [],
          },
          ...reading.spaces,
        ],
      };
    },
    async measure(image, corners, opts) {
      const located = await locate(image, { ...opts, corners });
      try {
        return measureBoard(located.pixels, located.corners).spaces.map(({ key, features }) => ({
          key,
          features,
        }));
      } finally {
        located.release();
      }
    },
    features: profile.features,
    withProfile: (next) => createGame(next),
  };
}

export const profile = ProfileSchema.parse(profileJson);

/** What `pnpm eval:cv harmonies` and the CV worker use (`CvGame`). */
export const cvGame = createGame(profile);
export const detector = cvGame.detector;

/**
 * Rereads a photo at known corners as the given side ("Reread Photo as Side X",
 * docs/UX.md → Board side switch). Plain TypeScript, so it runs on the main thread: the worker
 * protocol and `DetectOptions` can't carry a side.
 */
export function rereadAsSide(
  image: ImageInput,
  corners: Quad,
  side: HarmoniesSide,
): { state: HarmoniesState; confidence: ConfidenceMap } {
  const pixels: Pixels = {
    data: image.data,
    width: image.width,
    height: image.height,
    channels: 4,
  };
  return draftFromReading(readBoard(pixels, corners, profile, { side }));
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw new Error('Detection was aborted');
}
