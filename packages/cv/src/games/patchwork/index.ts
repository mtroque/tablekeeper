import type { DetectOptions, Draft, ImageInput, PatchworkState, Quad } from '@tablekeeper/core';
import { z } from 'zod';

import type { BoardReading, CellReading, PipelineOptions } from '../../pipeline/board-pipeline';
import type { CvGame } from '../../pipeline/game';
import { isOpenCvLoaded, loadOpenCv } from '../../pipeline/opencv';

import { ROWS } from './board';
import { calibratePatchwork, type CalibrationImage } from './calibrate';
import { boardColor, classifySpaces } from './classify';
import { measureBoxBoard } from './measure';
import { BOARDS, PatchworkReferencesSchema, type PatchworkReferences } from './references';
import referencesJson from './references.json';

/** A fixture label (docs/DATA_ASSETS.md → labels.json format, Patchwork). */
export const PatchworkLabelSchema = z.object({
  board: z.enum(BOARDS),
  grid: z.array(z.string().regex(/^[#.]{9}$/)).length(ROWS),
  tokens: z.object({
    one: z.int().min(0),
    five: z.int().min(0),
    ten: z.int().min(0),
    twenty: z.int().min(0),
  }),
  specialTile: z.boolean(),
  expectedScore: z.int(),
});
export type PatchworkLabel = z.infer<typeof PatchworkLabelSchema>;

export const COVERED = 'covered';
export const EMPTY = 'empty';
/** Confidence key of the board color (`PATCHWORK_FIELD_KEYS.board` in core). */
export const BOARD_KEY = 'board';

/** Glare on some spaces: they are flagged, and the photo can be retaken. */
export function glareWarning(count: number): string {
  return `${count} ${count === 1 ? 'space has' : 'spaces have'} glare. Check ${count === 1 ? 'it' : 'them'}, or retake the photo away from overhead light.`;
}

/** The board read from a photo: the space and board-color readings and where the board is. */
export type BoxBoardReading = BoardReading & {
  board: (typeof BOARDS)[number];
  boardColorConfidence: number;
};

export type PatchworkCvGame = Omit<CvGame<PatchworkState, PatchworkLabel>, 'read'> & {
  /** Reads the board; `board` reads the spaces against that board instead of the detected one. */
  read(image: ImageInput, opts?: PatchworkReadOptions): Promise<BoxBoardReading>;
  references: PatchworkReferences;
  /**
   * Rebuilds `references.json` from the empty references and the labeled photos, and returns the
   * game using it (the eval hook asked for in P2's shared change requests).
   */
  calibrate(input: {
    references: CalibrationImage[];
    items: Array<CalibrationImage & { corners?: Quad; label: PatchworkLabel }>;
  }): Promise<{ files: Record<string, unknown>; summary: string[]; game: PatchworkCvGame }>;
};

export type PatchworkReadOptions = PipelineOptions & { board?: (typeof BOARDS)[number] };

export function createPatchworkGame(references: PatchworkReferences): PatchworkCvGame {
  async function read(
    image: ImageInput,
    opts: PatchworkReadOptions = {},
  ): Promise<BoxBoardReading> {
    if (!isOpenCvLoaded()) opts.onProgress?.('loading-opencv');
    await loadOpenCv();
    throwIfAborted(opts.signal);
    if (!opts.corners) opts.onProgress?.('finding-board');
    const sample = measureBoxBoard(image, {
      ...(opts.corners ? { corners: opts.corners } : {}),
      ...(opts.orientation === undefined ? {} : { orientation: opts.orientation }),
      onFound: () => {
        opts.onProgress?.('classifying');
        throwIfAborted(opts.signal);
      },
    });
    const color = boardColor(sample.frame, references.frameRed);
    const board = opts.board ?? color.board;
    const spaces = classifySpaces(sample, references.boards[board]);
    const glare = spaces.filter((space) => space.glare).length;
    const cells: CellReading[] = [
      ...spaces.map((space, index) => ({
        key: space.key,
        features: sample.cells[index]?.features ?? [],
        label: space.covered ? COVERED : EMPTY,
        confidence: space.confidence,
      })),
      { key: BOARD_KEY, features: [...sample.frame], label: board, confidence: color.confidence },
    ];
    return {
      corners: sample.corners,
      boardFound: sample.found,
      boardConfidence: sample.boardConfidence,
      cells,
      warnings: [...sample.warnings, ...(glare ? [glareWarning(glare)] : [])],
      board,
      boardColorConfidence: color.confidence,
    };
  }

  return {
    references,
    labelSchema: PatchworkLabelSchema,
    cellTruth: (label) => ({
      ...Object.fromEntries(
        label.grid.flatMap((line, row) =>
          Array.from({ length: ROWS }, (_, col) => [
            `${row},${col}`,
            line.charAt(col) === '#' ? COVERED : EMPTY,
          ]),
        ),
      ),
      [BOARD_KEY]: label.board,
    }),
    read,
    measure() {
      // Patchwork is calibrated from its empty references with `calibrate`, which the generic
      // profile (class centroids) can't hold.
      return Promise.reject(
        new Error('Patchwork calibrates with its own references (cvGame.calibrate).'),
      );
    },
    // No generic profile features: see `measure`.
    features: [],
    withProfile: () => createPatchworkGame(references),
    async calibrate(input) {
      const built = await calibratePatchwork({
        references: input.references,
        items: input.items.map((item) => ({
          name: item.name,
          image: item.image,
          ...(item.orientation === undefined ? {} : { orientation: item.orientation }),
          ...(item.corners ? { corners: item.corners } : {}),
          board: item.label.board,
          grid: item.label.grid.flatMap((line) =>
            Array.from({ length: ROWS }, (_, col) => line.charAt(col) === '#'),
          ),
        })),
      });
      return {
        files: { 'references.json': built.references },
        summary: built.summary,
        game: createPatchworkGame(built.references),
      };
    },
    detector: {
      async detect(image: ImageInput, opts?: DetectOptions): Promise<Draft<PatchworkState>> {
        const reading = await read(image, opts);
        const spaces = reading.cells.filter((cell) => cell.key !== BOARD_KEY);
        return {
          state: {
            board: reading.board,
            grid: spaces.map((cell) => cell.label === COVERED),
            // Praline chits and the special tile are read in P3.
            tokens: { one: 0, five: 0, ten: 0, twenty: 0 },
            specialTile: false,
          },
          confidence: Object.fromEntries(
            reading.cells.map((cell) => [cell.key, Math.round(cell.confidence * 1000) / 1000]),
          ),
          corners: reading.corners,
          warnings: reading.warnings,
        };
      },
    },
  };
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw new Error('Detection was aborted');
}

export const cvGame = createPatchworkGame(PatchworkReferencesSchema.parse(referencesJson));
export const detector = cvGame.detector;
