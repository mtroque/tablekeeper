import type { ImageInput, Quad } from '@tablekeeper/core';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { loadOpenCvInNode } from '../../node';
import { trackMats, type MatTracker } from '../../pipeline/mat-tracker';
import { getCv, type Mat } from '../../pipeline/opencv';
import { seededRandom } from '../../pipeline/synthetic';

import { buildChitTemplates, CHITS_UNREAD, readChits, TEMPLATE_SIZE } from './chits';

import { cvGame } from './index';

// A synthetic table: a plain box board, and chits drawn beside it. Purple chits and the special
// tile are the committed templates tinted purple, so their art is what the matcher knows.

const WIDTH = 900;
const HEIGHT = 600;
const BOARD: Quad = [
  { x: 420, y: 100 },
  { x: 820, y: 100 },
  { x: 820, y: 500 },
  { x: 420, y: 500 },
];
const TABLE = [168, 132, 96, 255];

type Chit =
  | { kind: 'one'; x: number; y: number }
  | { kind: 'five' | 'ten' | 'twenty' | 'special'; x: number; y: number; turn?: 0 | 1 | 2 | 3 };

/** Sizes in pixels against the 400 px board, as measured on the fixtures. */
const SIZES = {
  five: { width: 42, height: 52 },
  ten: { width: 36, height: 60 },
  twenty: { width: 52, height: 56 },
  special: { width: 72, height: 96 },
} as const;
const ONE_RADIUS = 15;

function scene(chits: Chit[], seed = 1): Mat {
  const cv = getCv();
  const random = seededRandom(seed);
  const mat = new cv.Mat(HEIGHT, WIDTH, cv.CV_8UC3, TABLE);
  // Wood grain noise, so the table isn't one flat color.
  for (let i = 0; i < mat.data.length; i++) {
    mat.data[i] = Math.max(0, Math.min(255, (mat.data[i] as number) + (random() - 0.5) * 8));
  }
  cv.rectangle(mat, BOARD[0], BOARD[2], [120, 30, 42, 255], -1);
  for (const chit of chits) {
    if (chit.kind === 'one') {
      cv.circle(mat, { x: chit.x, y: chit.y }, ONE_RADIUS, [214, 178, 70, 255], -1, cv.LINE_AA);
      cv.circle(mat, { x: chit.x - 4, y: chit.y - 3 }, 5, [240, 214, 120, 255], -1);
      continue;
    }
    const template = cvGame.chits.templates.find((t) => t.kind === chit.kind);
    if (!template) throw new Error(`No ${chit.kind} template`);
    const gray = cv.matFromArray(TEMPLATE_SIZE.height, TEMPLATE_SIZE.width, cv.CV_8UC1, [
      ...template.pixels,
    ]);
    const size = SIZES[chit.kind];
    const sized = new cv.Mat();
    cv.resize(gray, sized, new cv.Size(size.width, size.height), 0, 0, cv.INTER_LINEAR);
    gray.delete();
    const turned = new cv.Mat();
    const codes = [-1, cv.ROTATE_90_CLOCKWISE, cv.ROTATE_180, cv.ROTATE_90_COUNTERCLOCKWISE];
    const code = codes[chit.turn ?? 0] as number;
    if (code < 0) sized.copyTo(turned);
    else cv.rotate(sized, turned, code);
    sized.delete();
    const x0 = Math.round(chit.x - turned.cols / 2);
    const y0 = Math.round(chit.y - turned.rows / 2);
    for (let y = 0; y < turned.rows; y++) {
      for (let x = 0; x < turned.cols; x++) {
        const g = turned.data[y * turned.cols + x] as number;
        const i = ((y0 + y) * WIDTH + x0 + x) * 3;
        // Purple: blue and red over green, lightness from the template.
        mat.data[i] = Math.min(255, 50 + g * 0.6);
        mat.data[i + 1] = Math.min(255, 24 + g * 0.45);
        mat.data[i + 2] = Math.min(255, 90 + g * 0.65);
      }
    }
    turned.delete();
  }
  return mat;
}

beforeAll(async () => {
  await loadOpenCvInNode();
});

describe('praline chits beside the box board', () => {
  it('PAT-SCORE-4: counts 1, 5, 10 and 20 chits and finds the special tile', () => {
    const mat = scene([
      { kind: 'one', x: 60, y: 60 },
      { kind: 'one', x: 120, y: 70 },
      { kind: 'one', x: 80, y: 130 },
      // Two touching 1 chits still count as two.
      { kind: 'one', x: 200, y: 60 },
      { kind: 'one', x: 229, y: 60 },
      { kind: 'five', x: 80, y: 250 },
      { kind: 'five', x: 170, y: 260, turn: 2 },
      { kind: 'ten', x: 270, y: 250, turn: 1 },
      { kind: 'twenty', x: 90, y: 380 },
      { kind: 'special', x: 250, y: 420, turn: 3 },
    ]);
    const reading = readChits(mat, BOARD, cvGame.chits);
    mat.delete();
    expect(reading.tokens).toEqual({ one: 5, five: 2, ten: 1, twenty: 1 });
    expect(reading.specialTile).toBe(true);
    expect(Math.min(...Object.values(reading.confidence))).toBeGreaterThanOrEqual(0.6);
    expect(reading.warnings).toEqual([]);
  });

  it('reads no chits and no special tile from a bare table, with full confidence', () => {
    const mat = scene([]);
    const reading = readChits(mat, BOARD, cvGame.chits);
    mat.delete();
    expect(reading.tokens).toEqual({ one: 0, five: 0, ten: 0, twenty: 0 });
    expect(reading.specialTile).toBe(false);
    expect(Object.values(reading.confidence).every((c) => c === 1)).toBe(true);
  });

  it('flags every count and warns when a region is too big to be one chit or the tile', () => {
    const cv = getCv();
    const mat = scene([{ kind: 'five', x: 80, y: 250 }]);
    // A heap of chits run together into one purple patch.
    cv.rectangle(mat, { x: 120, y: 60 }, { x: 300, y: 200 }, [110, 70, 150, 255], -1);
    const reading = readChits(mat, BOARD, cvGame.chits);
    mat.delete();
    expect(reading.warnings).toEqual([CHITS_UNREAD]);
    expect(Math.max(...Object.values(reading.confidence))).toBeLessThan(0.6);
  });

  it('ignores the board and anything on it', () => {
    const cv = getCv();
    const mat = scene([]);
    cv.circle(mat, { x: 600, y: 300 }, ONE_RADIUS, [214, 178, 70, 255], -1);
    const reading = readChits(mat, BOARD, cvGame.chits);
    mat.delete();
    expect(reading.tokens.one).toBe(0);
  });
});

describe('chit templates', () => {
  it('builds an upright template from each reference crop and none without them', () => {
    const mat = scene([{ kind: 'ten', x: 450, y: 300, turn: 1 }]);
    const image = rgbaOf(mat);
    mat.delete();
    expect(buildChitTemplates([{ name: 'references/empty-red-1.jpg', image }])).toBeUndefined();
    const built = buildChitTemplates([{ name: 'references/token-10-a.jpg', image }]);
    expect(built?.templates.map((t) => [t.kind, t.name])).toEqual([
      ['ten', 'references/token-10-a.jpg'],
    ]);
    expect(built?.templates[0]?.pixels).toHaveLength(TEMPLATE_SIZE.width * TEMPLATE_SIZE.height);
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

  it('after reading chits', () => {
    const mat = scene([
      { kind: 'one', x: 60, y: 60 },
      { kind: 'five', x: 80, y: 250 },
    ]);
    readChits(mat, BOARD, cvGame.chits);
    mat.delete();
    expect(tracker.live()).toBe(0);
  });
});

function rgbaOf(mat: Mat): ImageInput {
  const data = new Uint8ClampedArray(mat.cols * mat.rows * 4);
  for (let i = 0; i < mat.cols * mat.rows; i++) {
    data[i * 4] = mat.data[i * 3] as number;
    data[i * 4 + 1] = mat.data[i * 3 + 1] as number;
    data[i * 4 + 2] = mat.data[i * 3 + 2] as number;
    data[i * 4 + 3] = 255;
  }
  return { data, width: mat.cols, height: mat.rows };
}
