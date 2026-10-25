import { beforeAll, describe, expect, it } from 'vitest';

import { exampleBoard, renderExampleBoard } from '../games/_example/board';
import { cvGame } from '../games/_example/index';
import { loadOpenCvInNode } from '../node';

import { sampleCells } from './cells';
import { cellFeatures } from './features';
import { normalizeLighting } from './normalize';
import { getCv, type Mat } from './opencv';
import { renderSyntheticPhoto, TINTS } from './synthetic';

const GRID = [
  [true, false, false],
  [false, true, true],
  [true, false, true],
];

beforeAll(async () => {
  await loadOpenCvInNode();
});

function channelMeans(mat: Mat): number[] {
  const sums = [0, 0, 0];
  for (let i = 0; i < mat.data.length; i += 3) {
    for (let c = 0; c < 3; c++) sums[c] = sums[c]! + mat.data[i + c]!;
  }
  return sums.map((s) => s / (mat.data.length / 3));
}

describe('normalizeLighting', () => {
  it('balances a tinted board toward gray', () => {
    const cv = getCv();
    const board = renderExampleBoard(GRID);
    const tinted = new cv.Mat();
    board.convertTo(tinted, -1, 1, 0);
    for (let i = 0; i < tinted.data.length; i += 3) {
      tinted.data[i] = Math.min(255, tinted.data[i]! * 1.2);
      tinted.data[i + 2] = tinted.data[i + 2]! * 0.75;
    }
    const before = channelMeans(tinted);
    const out = normalizeLighting(tinted);
    const after = channelMeans(out);
    expect(Math.abs(after[0]! - after[2]!)).toBeLessThan(Math.abs(before[0]! - before[2]!) / 3);
    for (const m of [board, tinted, out]) m.delete();
  });

  it('a cell under warm and cool light classifies the same', async () => {
    const board = renderExampleBoard(GRID, 3);
    const read = async (tint: [number, number, number]) => {
      const { image } = renderSyntheticPhoto(board, {
        seed: 21,
        width: 800,
        height: 600,
        tint,
        rotation: 12,
      });
      return cvGame.read(image);
    };
    const warm = await read([...TINTS.warm]);
    const cool = await read([...TINTS.cool]);
    board.delete();
    const labels = (cells: typeof warm.cells) => cells.map((c) => c.label);
    expect(labels(warm.cells)).toEqual(labels(cool.cells));
    expect(labels(warm.cells)).toEqual(
      GRID.flat().map((covered) => (covered ? 'covered' : 'empty')),
    );
  });

  it('brings warm and cool versions of the same empty space close together in LAB', () => {
    const cv = getCv();
    const board = renderExampleBoard(GRID);
    const tint = (factors: readonly number[]) => {
      const out = board.clone();
      for (let i = 0; i < out.data.length; i++)
        out.data[i] = Math.min(255, out.data[i]! * factors[i % 3]!);
      return out;
    };
    const emptyColor = (mat: Mat) => {
      const normalized = normalizeLighting(mat);
      const region = sampleCells(normalized, exampleBoard.layout, { inset: 0.3 })[1]!;
      normalized.delete();
      return cellFeatures(region).lab;
    };
    const warm = tint(TINTS.warm);
    const cool = tint(TINTS.cool);
    const [wl, wa, wb] = emptyColor(warm);
    const [cl, ca, cb] = emptyColor(cool);
    expect(Math.hypot(wl - cl, wa - ca, wb - cb)).toBeLessThan(5);
    for (const m of [board, warm, cool]) m.delete();
    expect(cv).toBeDefined();
  });
});
