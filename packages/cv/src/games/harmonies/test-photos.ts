// Test helpers (Node only): reads Harmonies fixture photos, and draws a synthetic board photo.
import type { HarmoniesSide, ImageInput, Point, Quad } from '@tablekeeper/core';
import jpeg from 'jpeg-js';

import { getCv } from '../../pipeline/opencv';
import { renderSyntheticPhoto, type SyntheticPhotoOptions } from '../../pipeline/synthetic';

import { hexCenters } from './geometry';
import { outlineModel } from './outline-fit';

type NodeProcess = {
  getBuiltinModule(id: 'node:fs'): { readFileSync(path: URL): Uint8Array };
};

const FIXTURES = new URL('../../../../../data/fixtures/harmonies/', import.meta.url);

function readFile(path: string): Uint8Array {
  const nodeProcess = (globalThis as { process?: NodeProcess }).process;
  if (!nodeProcess) throw new Error('Fixture photos are read only in Node');
  return nodeProcess.getBuiltinModule('node:fs').readFileSync(new URL(path, FIXTURES));
}

/** A photo under `data/fixtures/harmonies/` as RGBA pixels. */
export function fixturePhoto(path: string): ImageInput {
  const raw = jpeg.decode(readFile(path), { useTArray: true, formatAsRGBA: true });
  return {
    data: new Uint8ClampedArray(raw.data.buffer, raw.data.byteOffset, raw.data.length),
    width: raw.width,
    height: raw.height,
  };
}

/** `data/fixtures/harmonies/labels.json`, parsed later by the caller's schema. */
export function fixtureLabels(): unknown {
  return JSON.parse(new TextDecoder().decode(readFile('labels.json')));
}

export function toQuad(corners: ReadonlyArray<readonly [number, number]>): Quad {
  const p = (i: number): Point => {
    const [x, y] = corners[i] ?? [0, 0];
    return { x, y };
  };
  return [p(0), p(1), p(2), p(3)];
}

const TABLE: [number, number, number] = [40, 36, 34];
const BOARD: Record<HarmoniesSide, [number, number, number]> = {
  A: [134, 122, 98],
  B: [112, 136, 150],
};
const SPACE: [number, number, number] = [214, 208, 196];
const TOKENS: Array<[number, number, number]> = [
  [52, 128, 190],
  [232, 182, 52],
  [120, 120, 126],
  [104, 66, 50],
  [118, 156, 70],
  [200, 70, 96],
];

/**
 * A synthetic photo of a board on a dark table, with the side's spaces and a token on every
 * other space. Returns the photo and the board rectangle's true corners.
 */
export function syntheticBoardPhoto(
  side: HarmoniesSide,
  opts: Omit<SyntheticPhotoOptions, 'table'>,
): { image: ImageInput; corners: Quad } {
  const cv = getCv();
  const width = 500;
  const height = Math.round(width * 0.79);
  const board = new cv.Mat(height, width, cv.CV_8UC3, [...TABLE, 255]);
  const polygon = (points: Point[], color: [number, number, number]) => {
    const flat = points.flatMap((p) => [Math.round(p.x), Math.round(p.y)]);
    const mat = cv.matFromArray(points.length, 1, cv.CV_32SC2, flat);
    const list = new cv.MatVector();
    list.push_back(mat);
    cv.fillPoly(board, list, [...color, 255]);
    list.delete();
    mat.delete();
  };
  const outline = outlineModel(0.01).map((p) => ({ x: p.u * (width - 1), y: p.v * (height - 1) }));
  polygon(outline, BOARD[side]);
  // The model leaves out the rounded top corners; draw them square.
  polygon(
    [
      { x: 0, y: 0 },
      { x: width - 1, y: 0 },
      { x: width - 1, y: 0.06 * height },
      { x: 0, y: 0.06 * height },
    ],
    BOARD[side],
  );
  const { centers, size } = hexCenters(side, width);
  centers.forEach((c, i) => {
    const hex = Array.from({ length: 6 }, (_, k) => ({
      x: c.x + 0.91 * size * Math.cos((k * Math.PI) / 3),
      y: c.y + 0.91 * size * Math.sin((k * Math.PI) / 3),
    }));
    polygon(hex, SPACE);
    if (i % 2 === 0) {
      const color = TOKENS[i % TOKENS.length] ?? SPACE;
      cv.circle(board, { x: c.x, y: c.y }, 0.78 * size, [...color, 255], -1, cv.LINE_AA);
    }
  });
  const photo = renderSyntheticPhoto(board, { ...opts, table: TABLE });
  board.delete();
  return photo;
}

/** Turns RGBA pixels a quarter turn clockwise, and maps points along. */
export function turnQuarter(image: ImageInput): {
  image: ImageInput;
  map: (p: Point) => Point;
} {
  const { width, height, data } = image;
  const out = new Uint8ClampedArray(data.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const nx = height - 1 - y;
      const ny = x;
      out.set(data.subarray((y * width + x) * 4, (y * width + x) * 4 + 4), (ny * height + nx) * 4);
    }
  }
  return {
    image: { data: out, width: height, height: width },
    map: (p) => ({ x: height - 1 - p.y, y: p.x }),
  };
}
