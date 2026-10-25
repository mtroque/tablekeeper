import type { ImageInput } from '@tablekeeper/core';

import { getCv, type Mat } from './opencv';

export type LoadImageOptions = {
  /** Longest side after downscaling. */
  maxSide?: number;
  /** EXIF orientation (1 to 8) still to apply; browsers have already applied it when decoding. */
  orientation?: number;
};

export type LoadedImage = {
  /** RGB, 8 bits per channel. The caller deletes it. */
  mat: Mat;
  /** Loaded size over oriented original size; divide by it to get back to original pixels. */
  scale: number;
};

/** RGBA pixels to an oriented, downscaled RGB Mat. */
export function loadImage(input: ImageInput, opts: LoadImageOptions = {}): LoadedImage {
  const cv = getCv();
  const { maxSide = 1600, orientation = 1 } = opts;
  const rgba = new cv.Mat(input.height, input.width, cv.CV_8UC4);
  rgba.data.set(input.data);
  let rgb = new cv.Mat();
  cv.cvtColor(rgba, rgb, cv.COLOR_RGBA2RGB);
  rgba.delete();

  rgb = applyOrientation(rgb, orientation);

  const longest = Math.max(rgb.rows, rgb.cols);
  if (longest <= maxSide) return { mat: rgb, scale: 1 };
  const scale = maxSide / longest;
  const small = new cv.Mat();
  cv.resize(
    rgb,
    small,
    new cv.Size(Math.round(rgb.cols * scale), Math.round(rgb.rows * scale)),
    0,
    0,
    cv.INTER_AREA,
  );
  rgb.delete();
  return { mat: small, scale };
}

/** Returns a new Mat for orientations other than 1 and deletes the input; otherwise the input. */
function applyOrientation(src: Mat, orientation: number): Mat {
  const cv = getCv();
  const steps: Array<(from: Mat, to: Mat) => void> = [];
  const rotate = (code: number) => (from: Mat, to: Mat) => {
    cv.rotate(from, to, code);
  };
  const flipH = (from: Mat, to: Mat) => {
    cv.flip(from, to, 1);
  };
  const flipV = (from: Mat, to: Mat) => {
    cv.flip(from, to, 0);
  };
  switch (orientation) {
    case 2:
      steps.push(flipH);
      break;
    case 3:
      steps.push(rotate(cv.ROTATE_180));
      break;
    case 4:
      steps.push(flipV);
      break;
    case 5:
      steps.push(rotate(cv.ROTATE_90_CLOCKWISE), flipH);
      break;
    case 6:
      steps.push(rotate(cv.ROTATE_90_CLOCKWISE));
      break;
    case 7:
      steps.push(rotate(cv.ROTATE_90_COUNTERCLOCKWISE), flipH);
      break;
    case 8:
      steps.push(rotate(cv.ROTATE_90_COUNTERCLOCKWISE));
      break;
    default:
      break;
  }
  let current = src;
  for (const step of steps) {
    const next = new cv.Mat();
    step(current, next);
    current.delete();
    current = next;
  }
  return current;
}
