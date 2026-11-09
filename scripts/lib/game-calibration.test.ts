import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import jpeg from 'jpeg-js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';

import type { ImageInput, Quad } from '../../packages/core/src';
import type { CvGame } from '../../packages/cv/src';

import { readReferences, runGameCalibration, type CalibrationItem } from './game-calibration';

type Label = { board: string };
type CalibrateInput = Parameters<NonNullable<CvGame<unknown, Label>['calibrate']>>[0];

const P = { x: 0, y: 0 };
const CORNERS: Quad = [P, { x: 4, y: 0 }, { x: 4, y: 4 }, { x: 0, y: 4 }];

function jpegBytes(width: number, height: number): Buffer {
  const data = Buffer.alloc(width * height * 4, 128);
  return jpeg.encode({ data, width, height }, 90).data;
}

/** A game whose `calibrate` records its input and returns `files`. */
function fakeGame(files: Record<string, unknown>, calls: CalibrateInput[] = []) {
  const calibrated: CvGame<unknown, Label> = {
    detector: { detect: () => Promise.reject(new Error('unused')) },
    labelSchema: z.object({ board: z.string() }),
    cellTruth: () => ({}),
    read: () => Promise.reject(new Error('unused')),
    measure: () => Promise.reject(new Error('unused')),
    features: [],
    withProfile: () => calibrated,
  };
  const game: CvGame<unknown, Label> = {
    ...calibrated,
    calibrate(input) {
      calls.push(input);
      return Promise.resolve({ files, summary: ['Calibrated 2 boards.'], game: calibrated });
    },
  };
  return { game, calibrated, calls };
}

let root: string;
let fixturesDir: string;
let gameDir: string;
const ITEMS: Array<CalibrationItem<Label>> = [
  {
    name: 'images/01.jpg',
    image: { data: new Uint8ClampedArray(64), width: 4, height: 4 } satisfies ImageInput,
    orientation: 1,
    corners: CORNERS,
    label: { board: 'blue' },
  },
];

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'tk-calibration-'));
  fixturesDir = join(root, 'fixtures');
  gameDir = join(root, 'game');
  mkdirSync(join(fixturesDir, 'references'), { recursive: true });
  mkdirSync(gameDir);
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('readReferences', () => {
  it('decodes every JPEG in references/, sorted and named references/<file>', () => {
    writeFileSync(join(fixturesDir, 'references/b-green.jpg'), jpegBytes(8, 4));
    writeFileSync(join(fixturesDir, 'references/a-blue.jpeg'), jpegBytes(4, 6));
    writeFileSync(join(fixturesDir, 'references/notes.txt'), 'not a photo');
    const refs = readReferences(fixturesDir);
    expect(refs.map((r) => r.name)).toEqual(['references/a-blue.jpeg', 'references/b-green.jpg']);
    expect(refs.map((r) => [r.image.width, r.image.height])).toEqual([
      [4, 6],
      [8, 4],
    ]);
    expect(refs[0]!.image.data).toHaveLength(4 * 6 * 4);
    expect(refs[0]!.orientation).toBe(1);
  });

  it('is empty without a references folder', () => {
    rmSync(join(fixturesDir, 'references'), { recursive: true });
    expect(readReferences(fixturesDir)).toEqual([]);
  });
});

describe('runGameCalibration', () => {
  it('passes references and labeled items, writes formatted JSON and returns the new game', async () => {
    writeFileSync(join(fixturesDir, 'references/blue.jpg'), jpegBytes(4, 4));
    const { game, calibrated, calls } = fakeGame({
      'references.json': { blue: [1, 2, 3] },
      'thresholds.json': { empty: 0.5 },
    });
    const result = await runGameCalibration({ game, fixturesDir, gameDir, items: ITEMS });

    expect(calls).toHaveLength(1);
    expect(calls[0]!.references.map((r) => r.name)).toEqual(['references/blue.jpg']);
    expect(calls[0]!.items).toEqual(ITEMS);
    expect(result.game).toBe(calibrated);
    expect(result.summary).toEqual(['Calibrated 2 boards.']);
    expect(result.written).toEqual(['references.json', 'thresholds.json']);
    expect(readFileSync(join(gameDir, 'references.json'), 'utf8')).toBe('{ "blue": [1, 2, 3] }\n');
    expect(JSON.parse(readFileSync(join(gameDir, 'thresholds.json'), 'utf8'))).toEqual({
      empty: 0.5,
    });
  });

  it('refuses file names outside the game folder before writing anything', async () => {
    const { game } = fakeGame({ 'ok.json': {}, '../profile.json': {} });
    await expect(runGameCalibration({ game, fixturesDir, gameDir, items: ITEMS })).rejects.toThrow(
      '../profile.json',
    );
    expect(() => readFileSync(join(gameDir, 'ok.json'))).toThrow();
  });

  it('needs a game with calibrate', async () => {
    const { calibrated } = fakeGame({});
    await expect(
      runGameCalibration({ game: calibrated, fixturesDir, gameDir, items: ITEMS }),
    ).rejects.toThrow('no calibrate');
  });
});
