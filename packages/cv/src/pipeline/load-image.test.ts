import type { ImageInput } from '@tablekeeper/core';
import { beforeAll, describe, expect, it } from 'vitest';

import { loadOpenCvInNode } from '../node';

import { loadImage } from './load-image';

/** A 4 × 2 RGBA image, red at the top-left pixel and gray elsewhere. */
function marked(width = 4, height = 2): ImageInput {
  const data = new Uint8ClampedArray(width * height * 4).fill(100);
  data.set([255, 0, 0, 255], 0);
  for (let i = 3; i < data.length; i += 4) data[i] = 255;
  return { data, width, height };
}

/** Where the red pixel ended up. */
function redAt(mat: { rows: number; cols: number; data: Uint8Array }): [number, number] {
  for (let y = 0; y < mat.rows; y++) {
    for (let x = 0; x < mat.cols; x++) {
      if (mat.data[(y * mat.cols + x) * 3] === 255) return [x, y];
    }
  }
  return [-1, -1];
}

beforeAll(async () => {
  await loadOpenCvInNode();
});

describe('loadImage', () => {
  it('converts RGBA to RGB and keeps small images as they are', () => {
    const { mat, scale } = loadImage(marked());
    expect([mat.cols, mat.rows, mat.channels(), scale]).toEqual([4, 2, 3, 1]);
    expect(redAt(mat)).toEqual([0, 0]);
    mat.delete();
  });

  it('downscales so the longest side is maxSide', () => {
    const big = {
      data: new Uint8ClampedArray(3200 * 1000 * 4).fill(200),
      width: 3200,
      height: 1000,
    };
    const { mat, scale } = loadImage(big, { maxSide: 1600 });
    expect([mat.cols, mat.rows, scale]).toEqual([1600, 500, 0.5]);
    mat.delete();
  });

  it.each([
    [1, [4, 2], [0, 0]],
    [2, [4, 2], [3, 0]],
    [3, [4, 2], [3, 1]],
    [4, [4, 2], [0, 1]],
    [5, [2, 4], [0, 0]],
    [6, [2, 4], [1, 0]],
    [7, [2, 4], [1, 3]],
    [8, [2, 4], [0, 3]],
  ])('applies EXIF orientation %i', (orientation, size, red) => {
    const { mat } = loadImage(marked(), { orientation });
    expect([mat.cols, mat.rows]).toEqual(size);
    expect(redAt(mat)).toEqual(red);
    mat.delete();
  });
});
