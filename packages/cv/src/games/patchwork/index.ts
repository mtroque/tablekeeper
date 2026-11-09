import type { DetectOptions, Draft, ImageInput, PatchworkState, Quad } from '@tablekeeper/core';
import { z } from 'zod';

import type { BoardReading, CellReading, PipelineOptions } from '../../pipeline/board-pipeline';
import type { CvGame } from '../../pipeline/game';
import { isOpenCvLoaded, loadOpenCv } from '../../pipeline/opencv';

import { ROWS } from './board';
import { calibratePatchwork, type CalibrationImage } from './calibrate';
import {
  buildChitTemplates,
  CHIT_KINDS,
  ChitTemplatesSchema,
  readChits,
  type ChitKind,
  type ChitReading,
  type ChitTemplates,
} from './chits';
import chitsJson from './chits.json';
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

/** `DetectOptions.hints.board`: read the spaces against this board (the editor's board switch). */
const BoardHintSchema = z.enum(BOARDS);

export const COVERED = 'covered';
export const EMPTY = 'empty';
/** Confidence key of the board color (`PATCHWORK_FIELD_KEYS.board` in core). */
export const BOARD_KEY = 'board';
/** Confidence keys of the chit counts and the special tile (`PATCHWORK_FIELD_KEYS` in core). */
export const TOKEN_KEYS: Record<ChitKind, string> = {
  one: 'tokens.one',
  five: 'tokens.five',
  ten: 'tokens.ten',
  twenty: 'tokens.twenty',
};
export const SPECIAL_TILE_KEY = 'specialTile';
/** Labels of the special tile pseudo-cell. */
export const HELD = 'yes';
export const NOT_HELD = 'no';
const SPACE_KEY = /^\d,\d$/;

/** Glare on some spaces: they are flagged, and the photo can be retaken. */
export function glareWarning(count: number): string {
  return `${count} ${count === 1 ? 'space has' : 'spaces have'} glare. Check ${count === 1 ? 'it' : 'them'}, or retake the photo away from overhead light.`;
}

/**
 * The board read from a photo: the space, board-color, chit and special tile readings and where
 * the board is. Chit counts are pseudo-cells labeled with the count, so the eval scores them too.
 */
export type BoxBoardReading = BoardReading & {
  board: (typeof BOARDS)[number];
  boardColorConfidence: number;
  tokens: ChitReading['tokens'];
  specialTile: boolean;
};

export type PatchworkCvGame = Omit<CvGame<PatchworkState, PatchworkLabel>, 'read' | 'calibrate'> & {
  /** Reads the board; `board` reads the spaces against that board instead of the detected one. */
  read(image: ImageInput, opts?: PatchworkReadOptions): Promise<BoxBoardReading>;
  references: PatchworkReferences;
  chits: ChitTemplates;
  /**
   * Rebuilds `references.json` from the empty references and the labeled photos, and `chits.json`
   * from the chit reference crops when there are any, and returns the game using them
   * (`pnpm eval:cv patchwork --calibrate`).
   */
  calibrate(input: {
    references: CalibrationImage[];
    items: Array<CalibrationImage & { corners?: Quad; label: PatchworkLabel }>;
  }): Promise<{ files: Record<string, unknown>; summary: string[]; game: PatchworkCvGame }>;
};

export type PatchworkReadOptions = PipelineOptions & { board?: (typeof BOARDS)[number] };

export function createPatchworkGame(
  references: PatchworkReferences,
  chits: ChitTemplates,
): PatchworkCvGame {
  async function read(
    image: ImageInput,
    opts: PatchworkReadOptions = {},
  ): Promise<BoxBoardReading> {
    if (!isOpenCvLoaded()) opts.onProgress?.('loading-opencv');
    await loadOpenCv();
    throwIfAborted(opts.signal);
    if (!opts.corners) opts.onProgress?.('finding-board');
    let chitReading: ChitReading | undefined;
    const sample = measureBoxBoard(image, {
      ...(opts.corners ? { corners: opts.corners } : {}),
      ...(opts.orientation === undefined ? {} : { orientation: opts.orientation }),
      onFound: () => {
        opts.onProgress?.('classifying');
        throwIfAborted(opts.signal);
      },
      onImage: (mat, quad) => {
        chitReading = readChits(mat, quad, chits);
      },
    });
    if (!chitReading) throw new Error('The chits were not read');
    const chit = chitReading;
    const detected = boardColor(sample.frame, references.frameRed);
    // A board the player chose is certain; otherwise it is read from the frame.
    const color = opts.board ? { board: opts.board, confidence: 1 } : detected;
    const board = color.board;
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
      ...CHIT_KINDS.map((kind) => ({
        key: TOKEN_KEYS[kind],
        features: [],
        label: String(chit.tokens[kind]),
        confidence: chit.confidence[kind],
      })),
      {
        key: SPECIAL_TILE_KEY,
        features: [],
        label: chit.specialTile ? HELD : NOT_HELD,
        confidence: chit.confidence.specialTile,
      },
    ];
    return {
      corners: sample.corners,
      boardFound: sample.found,
      boardConfidence: sample.boardConfidence,
      cells,
      warnings: [...sample.warnings, ...(glare ? [glareWarning(glare)] : []), ...chit.warnings],
      board,
      boardColorConfidence: color.confidence,
      tokens: chit.tokens,
      specialTile: chit.specialTile,
    };
  }

  return {
    references,
    chits,
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
      ...Object.fromEntries(
        CHIT_KINDS.map((kind) => [TOKEN_KEYS[kind], String(label.tokens[kind])]),
      ),
      [SPECIAL_TILE_KEY]: label.specialTile ? HELD : NOT_HELD,
    }),
    read,
    measure() {
      // Patchwork is calibrated from its empty references with `calibrate` (which
      // `pnpm eval:cv --calibrate` runs instead); the generic profile can't hold them.
      return Promise.reject(
        new Error('Patchwork calibrates with its own references (cvGame.calibrate).'),
      );
    },
    // No generic profile features: see `measure`.
    features: [],
    withProfile: () => createPatchworkGame(references, chits),
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
      const templates = buildChitTemplates(input.references);
      const summary = templates
        ? [`Built ${templates.templates.length} chit templates from the reference crops.`]
        : ['No chit reference crops; kept the committed chit templates.'];
      return {
        files: {
          'references.json': built.references,
          ...(templates ? { 'chits.json': templates } : {}),
        },
        summary: [...built.summary, ...summary],
        game: createPatchworkGame(built.references, templates ?? chits),
      };
    },
    detector: {
      async detect(image: ImageInput, opts?: DetectOptions): Promise<Draft<PatchworkState>> {
        const hinted = BoardHintSchema.safeParse(opts?.hints?.board);
        const reading = await read(image, {
          ...opts,
          ...(hinted.success ? { board: hinted.data } : {}),
        });
        const spaces = reading.cells.filter((cell) => SPACE_KEY.test(cell.key));
        return {
          state: {
            board: reading.board,
            grid: spaces.map((cell) => cell.label === COVERED),
            tokens: reading.tokens,
            specialTile: reading.specialTile,
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

export const cvGame = createPatchworkGame(
  PatchworkReferencesSchema.parse(referencesJson),
  ChitTemplatesSchema.parse(chitsJson),
);
export const detector = cvGame.detector;
