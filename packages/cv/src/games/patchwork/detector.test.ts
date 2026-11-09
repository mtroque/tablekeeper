import type { DetectStage, ImageInput, PatchworkBoard, Quad } from '@tablekeeper/core';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { loadOpenCvInNode } from '../../node';
import { BOARD_NOT_FOUND } from '../../pipeline/find-board';
import { cornerError } from '../../pipeline/geometry';
import { trackMats, type MatTracker } from '../../pipeline/mat-tracker';
import { getCv, type Mat } from '../../pipeline/opencv';
import { renderSyntheticPhoto, seededRandom, TINTS } from '../../pipeline/synthetic';

import { CELL, FRAME_INSET, ROWS, SIZE } from './board';

import { BOARD_KEY, cvGame, PatchworkLabelSchema, type PatchworkCvGame } from './index';

// A synthetic box board: a frame, spaces with a printed shadow along the top row and left column
// (so empty spaces differ by position, as on the real boards), and textured chocolate pieces.
const COLORS: Record<PatchworkBoard, { frame: number[]; space: number[] }> = {
  red: { frame: [120, 30, 42, 255], space: [168, 52, 62, 255] },
  gray: { frame: [118, 120, 124, 255], space: [176, 178, 182, 255] },
};
const PIECES = [
  [92, 58, 40, 255],
  [214, 190, 150, 255],
  [120, 70, 120, 255],
];

function renderBoxBoard(board: PatchworkBoard, grid: boolean[], seed: number): Mat {
  const cv = getCv();
  const random = seededRandom(seed);
  const { frame, space } = COLORS[board];
  const mat = new cv.Mat(SIZE, SIZE, cv.CV_8UC3, frame);
  const origin = SIZE * FRAME_INSET;
  for (let i = 0; i < ROWS * ROWS; i++) {
    const row = Math.floor(i / ROWS);
    const col = i % ROWS;
    const x = origin + col * CELL;
    const y = origin + row * CELL;
    const shade = row === 0 || col === 0 ? 0.8 : 1;
    const color = space.map((v, k) => (k < 3 ? v * shade : v));
    cv.rectangle(mat, { x, y }, { x: x + CELL - 1, y: y + CELL - 1 }, color, -1);
    if (!grid[i]) continue;
    const piece = PIECES[Math.floor(random() * PIECES.length)] as number[];
    cv.rectangle(mat, { x: x + 1, y: y + 1 }, { x: x + CELL - 2, y: y + CELL - 2 }, piece, -1);
    // Printed praline art: rings and dots.
    const center = { x: x + CELL / 2, y: y + CELL / 2 };
    cv.circle(mat, center, CELL * 0.3, [240, 220, 120, 255], 3, cv.LINE_AA);
    cv.circle(mat, center, CELL * 0.12, [60, 30, 20, 255], -1, cv.LINE_AA);
  }
  return mat;
}

function photo(
  board: PatchworkBoard,
  grid: boolean[],
  opts: { seed: number; rotation: number; tint?: [number, number, number]; brightness?: number },
): { image: ImageInput; corners: Quad } {
  const mat = renderBoxBoard(board, grid, opts.seed);
  const result = renderSyntheticPhoto(mat, {
    seed: opts.seed,
    width: 800,
    height: 640,
    rotation: opts.rotation,
    skew: 0.06,
    noise: 2,
    table: [220, 214, 200],
    ...(opts.tint ? { tint: opts.tint } : {}),
    ...(opts.brightness === undefined ? {} : { brightness: opts.brightness }),
  });
  mat.delete();
  return result;
}

const empty = Array.from({ length: 81 }, () => false);
const gridOf = (seed: number, emptyShare: number) => {
  const random = seededRandom(seed);
  return Array.from({ length: 81 }, () => random() > emptyShare);
};
const label = (board: PatchworkBoard, grid: boolean[]) =>
  PatchworkLabelSchema.parse({
    board,
    grid: Array.from({ length: ROWS }, (_, row) =>
      grid
        .slice(row * ROWS, row * ROWS + ROWS)
        .map((covered) => (covered ? '#' : '.'))
        .join(''),
    ),
    tokens: { one: 0, five: 0, ten: 0, twenty: 0 },
    specialTile: false,
    expectedScore: 0,
  });

let game: PatchworkCvGame;
const BOARDS: PatchworkBoard[] = ['red', 'gray'];

beforeAll(async () => {
  await loadOpenCvInNode();
  // Empty references photographed with the board turned different ways, and labeled photos.
  const references = BOARDS.flatMap((board, b) =>
    [0, 90, 180].map((rotation, i) => ({
      name: `references/empty-${board}-${i + 1}.jpg`,
      image: photo(board, empty, { seed: 10 + b * 10 + i, rotation: rotation + 4 }).image,
    })),
  );
  const items = BOARDS.flatMap((board, b) =>
    [0, 1].map((i) => {
      const grid = gridOf(30 + b * 10 + i, 0.2);
      // Like the real fixtures, the labeled photos vary the light.
      const shot = photo(board, grid, {
        seed: 30 + b * 10 + i,
        rotation: -6 + 8 * i,
        tint: i ? TINTS.cool : TINTS.warm,
        brightness: i ? 1 : 0.8,
      });
      return { name: `images/0${b * 2 + i + 1}.jpg`, ...shot, label: label(board, grid) };
    }),
  );
  game = (await cvGame.calibrate({ references, items })).game;
}, 60_000);

describe('patchwork detector on synthetic photos', () => {
  it.each(BOARDS)(
    'reads every space and the %s board from a board turned 180° under warm light',
    async (board) => {
      const grid = gridOf(board === 'red' ? 77 : 78, 0.15);
      const { image, corners } = photo(board, grid, {
        seed: board === 'red' ? 77 : 78,
        rotation: 183,
        tint: TINTS.warm,
        brightness: 0.85,
      });
      const stages: DetectStage[] = [];
      const draft = await game.detector.detect(image, { onProgress: (s) => stages.push(s) });
      expect(stages).toEqual(['finding-board', 'classifying']);
      expect(draft.state.board).toBe(board);
      expect(draft.confidence[BOARD_KEY]).toBeGreaterThan(0.9);
      // The board is upside down, so the photo's top-left space is the board's bottom-right.
      expect(draft.state.grid).toEqual(grid.slice().reverse());
      // 81 spaces, the board color, 4 chit counts and the special tile.
      expect(Object.keys(draft.confidence)).toHaveLength(87);
      expect(draft.confidence['tokens.five']).toBe(1);
      expect(draft.confidence['specialTile']).toBe(1);
      expect(cornerError(draft.corners, rotateQuad(corners, 2))).toBeLessThan(0.02);
      // Nothing lies beside the board.
      expect(draft.state.tokens).toEqual({ one: 0, five: 0, ten: 0, twenty: 0 });
      expect(draft.state.specialTile).toBe(false);
      expect(draft.warnings).toEqual([]);
    },
  );

  it('uses given corners without looking for the board', async () => {
    const grid = gridOf(5, 0.3);
    const { image, corners } = photo('red', grid, { seed: 5, rotation: 2 });
    const stages: DetectStage[] = [];
    const draft = await game.detector.detect(image, { corners, onProgress: (s) => stages.push(s) });
    expect(stages).toEqual(['classifying']);
    expect(draft.state.grid).toEqual(grid);
    expect(cornerError(draft.corners, corners)).toBeLessThan(1e-6);
  });

  it('reads against the board in the hint, for the board switch', async () => {
    const grid = gridOf(6, 0.3);
    const { image, corners } = photo('gray', grid, { seed: 6, rotation: 0 });
    const asRed = await game.detector.detect(image, { corners, hints: { board: 'red' } });
    expect(asRed.state.board).toBe('red');
    // The player chose it, so the board isn't outlined.
    expect(asRed.confidence[BOARD_KEY]).toBe(1);
    // Switching back reads the gray board's references again, and the spaces right.
    const asGray = await game.detector.detect(image, { corners, hints: { board: 'gray' } });
    expect(asGray.state.board).toBe('gray');
    expect(asGray.state.grid).toEqual(grid);
  });

  it('ignores a hint that names no board', async () => {
    const { image, corners } = photo('gray', gridOf(7, 0.3), { seed: 7, rotation: 0 });
    const draft = await game.detector.detect(image, { corners, hints: { board: 'blue' } });
    expect(draft.state.board).toBe('gray');
  });

  it('falls back to centered corners with a warning when there is no board', async () => {
    const cv = getCv();
    const blank = new cv.Mat(480, 640, cv.CV_8UC4, [200, 190, 170, 255]);
    const image = { data: new Uint8ClampedArray(blank.data), width: 640, height: 480 };
    blank.delete();
    const draft = await game.detector.detect(image);
    expect(draft.warnings).toContain(BOARD_NOT_FOUND);
    expect(draft.state.grid).toHaveLength(81);
  });

  it('stops when aborted', async () => {
    const { image } = photo('red', empty, { seed: 8, rotation: 0 });
    const controller = new AbortController();
    controller.abort();
    await expect(game.detector.detect(image, { signal: controller.signal })).rejects.toThrow(
      'aborted',
    );
  });

  it('a calibration without chit reference crops keeps the committed chit templates', () => {
    expect(game.chits).toBe(cvGame.chits);
    expect(new Set(cvGame.chits.templates.map((t) => t.kind))).toEqual(
      new Set(['five', 'ten', 'twenty', 'special']),
    );
  });

  it('the committed calibration loads and keeps measure out of the generic profile path', async () => {
    expect(cvGame.references.boards.red.references).toHaveLength(3);
    expect(cvGame.references.boards.gray.references).toHaveLength(3);
    const { image, corners } = photo('red', empty, { seed: 9, rotation: 0 });
    await expect(cvGame.measure(image, corners)).rejects.toThrow('calibrate');
  });
});

describe('no leaked Mats', () => {
  let tracker: MatTracker;
  beforeEach(() => {
    tracker = trackMats(getCv());
  });
  afterEach(() => {
    tracker.restore();
  });

  it('after a read with a found board, with given corners, and an aborted read', async () => {
    const grid = gridOf(11, 0.2);
    const { image, corners } = photo('gray', grid, { seed: 11, rotation: 12 });
    await game.detector.detect(image);
    await game.detector.detect(image, { corners });
    const controller = new AbortController();
    await expect(
      game.detector.detect(image, {
        signal: controller.signal,
        onProgress: (stage) => {
          if (stage === 'classifying') controller.abort();
        },
      }),
    ).rejects.toThrow();
    expect(tracker.total()).toBeGreaterThan(0);
    expect(tracker.live()).toBe(0);
  });
});

/** The same quad starting `turns` corners later (the board as seen when turned). */
function rotateQuad(quad: Quad, turns: number): Quad {
  return [0, 1, 2, 3].map((i) => quad[(i + turns) % 4]) as Quad;
}
