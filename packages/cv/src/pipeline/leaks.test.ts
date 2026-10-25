import type { ImageInput } from '@tablekeeper/core';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { exampleBoard, renderExampleBoard } from '../games/_example/board';
import { cvGame } from '../games/_example/index';
import { loadOpenCvInNode } from '../node';

import { findBlobs } from './blobs';
import { sampleCells } from './cells';
import { findBoardQuad } from './find-board';
import { loadImage } from './load-image';
import { trackMats, type MatTracker } from './mat-tracker';
import { matchTemplateRotInvariant } from './match';
import { normalizeLighting } from './normalize';
import { getCv } from './opencv';
import { renderSyntheticPhoto } from './synthetic';
import { warpToCanonical } from './warp';

const GRID = [
  [true, false, true],
  [false, false, true],
  [true, true, false],
];

let photo: ImageInput;
let tracker: MatTracker;

beforeAll(async () => {
  await loadOpenCvInNode();
  const board = renderExampleBoard(GRID);
  photo = renderSyntheticPhoto(board, { seed: 4, width: 640, height: 480, rotation: 10 }).image;
  board.delete();
});

beforeEach(() => {
  tracker = trackMats(getCv());
});

afterEach(() => {
  tracker.restore();
});

describe('no leaked Mats', () => {
  it('the tracker sees Mats from constructors and from opencv calls, and catches a leak', () => {
    const cv = getCv();
    const kept = new cv.Mat(2, 2, cv.CV_8UC1);
    const transform = cv.getRotationMatrix2D({ x: 0, y: 0 }, 10, 1);
    const view = kept.roi({ x: 0, y: 0, width: 1, height: 1 });
    expect(tracker.total()).toBe(3);
    expect(tracker.live()).toBe(3);
    transform.delete();
    view.delete();
    expect(tracker.live()).toBe(1);
    kept.delete();
    expect(tracker.live()).toBe(0);
  });

  it('each stage deletes what it allocates', () => {
    const { mat } = loadImage(photo, { maxSide: 400 });
    const found = findBoardQuad(mat, { aspect: exampleBoard.aspect });
    const warped = warpToCanonical(mat, found.quad, exampleBoard.canonical);
    const normalized = normalizeLighting(warped);
    sampleCells(normalized, exampleBoard.layout);
    const cv = getCv();
    const mask = new cv.Mat(normalized.rows, normalized.cols, cv.CV_8UC1, [0, 0, 0, 0]);
    cv.circle(mask, { x: 150, y: 150 }, 40, [255, 0, 0, 0], -1);
    findBlobs(normalized, mask);
    matchTemplateRotInvariant(normalized, [{ key: 'board', mat: warped }], { angleStep: 90 });
    // Only the stage outputs the test owns are still alive.
    expect(tracker.live()).toBe(4);
    for (const m of [mat, warped, normalized, mask]) m.delete();
    expect(tracker.live()).toBe(0);
    expect(tracker.total()).toBeGreaterThan(20);
  });

  it('a full read leaves nothing behind: board found', async () => {
    const reading = await cvGame.read(photo);
    expect(reading.boardFound).toBe(true);
    expect(tracker.total()).toBeGreaterThan(20);
    expect(tracker.live()).toBe(0);
  });

  it('a full read leaves nothing behind: no board, fallback corners', async () => {
    const blank = { data: new Uint8ClampedArray(320 * 240 * 4).fill(150), width: 320, height: 240 };
    const reading = await cvGame.read(blank);
    expect(reading.boardFound).toBe(false);
    expect(tracker.live()).toBe(0);
  });

  it('a full read leaves nothing behind: corners given, orientation applied', async () => {
    const draft = await cvGame.detector.detect(photo, {
      corners: [
        { x: 100, y: 50 },
        { x: 500, y: 50 },
        { x: 500, y: 430 },
        { x: 100, y: 430 },
      ],
    });
    expect(draft.warnings).toEqual([]);
    await cvGame.read(photo, { orientation: 6 });
    expect(tracker.live()).toBe(0);
  });

  it('an aborted read leaves nothing behind', async () => {
    const controller = new AbortController();
    const pending = cvGame.read(photo, {
      signal: controller.signal,
      onProgress: (stage) => {
        if (stage === 'finding-board') controller.abort();
      },
    });
    await expect(pending).rejects.toThrow('aborted');
    expect(tracker.live()).toBe(0);
  });
});
