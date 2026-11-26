import type { ImageInput, Quad } from '@tablekeeper/core';
import jpeg from 'jpeg-js';
import { describe, expect, it } from 'vitest';

import { rgbToLab } from '../../pipeline/features';
import { FixtureSetSchema } from '../../pipeline/fixtures';

import {
  byteLab,
  labToHex,
  LOOKS_EMPTY_DISTANCE,
  measureSpaceColors,
  spaceColors,
  type Lab,
} from './piece-colors';

import { cvGame, PatchworkLabelSchema } from './index';

type NodeProcess = { getBuiltinModule(id: 'node:fs'): { readFileSync(path: URL): Uint8Array } };
const ROOT = new URL('../../../../../', import.meta.url);

function readFile(path: string): Uint8Array {
  const nodeProcess = (globalThis as { process?: NodeProcess }).process;
  if (!nodeProcess) throw new Error('Fixture photos are read only in Node');
  return nodeProcess.getBuiltinModule('node:fs').readFileSync(new URL(path, ROOT));
}

function photo(path: string): ImageInput {
  const raw = jpeg.decode(readFile(path), { useTArray: true, formatAsRGBA: true });
  return {
    data: new Uint8ClampedArray(raw.data.buffer, raw.data.byteOffset, raw.data.length),
    width: raw.width,
    height: raw.height,
  };
}

const toQuad = (corners: ReadonlyArray<readonly [number, number]>, scale = 1): Quad =>
  [0, 1, 2, 3].map((i) => {
    const [x, y] = corners[i] ?? [0, 0];
    return { x: x * scale, y: y * scale };
  }) as Quad;

const fixtures = FixtureSetSchema.parse(
  JSON.parse(new TextDecoder().decode(readFile('data/fixtures/patchwork/labels.json'))),
).items.map((item) => ({
  image: item.image,
  corners: toQuad(item.corners ?? []),
  label: PatchworkLabelSchema.parse(item.label),
}));

const redWood = fixtures.find((f) => f.image.includes('02-red-wood-table'));
if (!redWood) throw new Error('Fixture 02 is missing');
const redWoodPhoto = photo(`data/fixtures/patchwork/${redWood.image}`);

const chroma = (lab: Lab) => Math.hypot(lab[1], lab[2]);

/**
 * Pieces in `02-red-wood-table.jpg`, labeled by eye from the photo: the purple piece with
 * raspberry pralines at the top, the olive yellow piece with silver pralines at the top right,
 * and the white chocolate pralines of the light green piece.
 */
const KNOWN_PIECES: Array<{ row: number; col: number; piece: string; is: (lab: Lab) => boolean }> =
  [
    { row: 0, col: 3, piece: 'purple', is: ([, a, b]) => a > 10 && b < -10 },
    { row: 1, col: 7, piece: 'yellow', is: ([, a, b]) => b > 10 && Math.abs(a) < 8 },
    { row: 1, col: 3, piece: 'white', is: (lab) => lab[0] > 80 && chroma(lab) < 8 },
  ];

describe('measureSpaceColors', () => {
  it('reads 81 colors from a fixture, and known pieces in their own colors', () => {
    const colors = spaceColors(
      measureSpaceColors(redWoodPhoto, redWood.corners),
      'red',
      cvGame.references,
    );
    expect(colors).toHaveLength(81);
    for (const color of colors) expect(color.hex).toMatch(/^#[0-9a-f]{6}$/);
    for (const known of KNOWN_PIECES) {
      const color = colors[known.row * 9 + known.col];
      expect(color && known.is(color.lab), `${known.piece} at ${known.row},${known.col}`).toBe(
        true,
      );
    }
  });

  it('corrects for the light: a dimmer photo gives close to the same colors', () => {
    const dim = new Uint8ClampedArray(redWoodPhoto.data.length);
    redWoodPhoto.data.forEach((v, i) => {
      dim[i] = i % 4 === 3 ? v : v * 0.75;
    });
    const dimPhoto = { ...redWoodPhoto, data: dim };
    const bright = measureSpaceColors(redWoodPhoto, redWood.corners);
    const dark = measureSpaceColors(dimPhoto, redWood.corners);
    const corrected = (m: typeof bright) =>
      spaceColors(m, 'red', cvGame.references).map((c) => c.lab);
    const median = (values: number[]) =>
      values.sort((p, q) => p - q)[Math.floor(values.length / 2)] ?? 0;
    const change = (a: Lab[], b: Lab[]) =>
      median(a.map((lab, i) => Math.hypot(...lab.map((v, k) => v - (b[i]?.[k] ?? 0)))));
    const raw = change(bright.spaces, dark.spaces);
    const fixed = change(corrected(bright), corrected(dark));
    // A shift is exact for an even change in lightness; dimming scales light pieces more than
    // the dark frame, so some change is left (measured: 12.6 raw, 6.7 corrected).
    expect(raw).toBeGreaterThan(10);
    expect(fixed).toBeLessThan(raw * 0.6);
  });

  it('reads a 1200px photo in under 100ms', () => {
    // `red-board.jpg` is fixture 02 downscaled to 1200px (docs/games/patchwork.md → Samples).
    const sample = photo('apps/web/public/samples/patchwork/red-board.jpg');
    const corners = toQuad(
      redWood.corners.map((p) => [p.x, p.y] as const),
      sample.height / redWoodPhoto.height,
    );
    measureSpaceColors(sample, corners);
    const runs = Array.from({ length: 3 }, () => {
      const start = performance.now();
      spaceColors(measureSpaceColors(sample, corners), 'red', cvGame.references);
      return performance.now() - start;
    });
    expect(Math.min(...runs)).toBeLessThan(100);
  });
});

describe('looksEmpty', () => {
  it('marks most labeled empty spaces and few covered ones, on every fixture', () => {
    let empty = 0;
    let emptyFlagged = 0;
    let covered = 0;
    let coveredFlagged = 0;
    for (const fixture of fixtures) {
      const colors = spaceColors(
        measureSpaceColors(photo(`data/fixtures/patchwork/${fixture.image}`), fixture.corners),
        fixture.label.board,
        cvGame.references,
      );
      const grid = fixture.label.grid.join('');
      colors.forEach((color, i) => {
        if (grid.charAt(i) === '#') {
          covered++;
          if (color.looksEmpty) coveredFlagged++;
        } else {
          empty++;
          if (color.looksEmpty) emptyFlagged++;
        }
      });
    }
    // Measured at LOOKS_EMPTY_DISTANCE 4: 55 of 82 empty, 10 of 566 covered (8 of them glare).
    expect(LOOKS_EMPTY_DISTANCE).toBe(4);
    expect(emptyFlagged / empty).toBeGreaterThan(0.6);
    expect(coveredFlagged / covered).toBeLessThan(0.025);
  });
});

describe('color conversions', () => {
  it('byteLab matches rgbToLab', () => {
    const colors: Array<[number, number, number]> = [
      [0, 0, 0],
      [255, 255, 255],
      [168, 69, 106],
      [12, 200, 90],
    ];
    for (const [r, g, b] of colors) {
      const expected = rgbToLab(r, g, b);
      byteLab(r, g, b).forEach((v, k) => {
        expect(v).toBeCloseTo(expected[k] ?? 0, 6);
      });
    }
  });

  it('labToHex inverts rgbToLab', () => {
    expect(labToHex(rgbToLab(168, 69, 106))).toBe('#a8456a');
    expect(labToHex(rgbToLab(255, 255, 255))).toBe('#ffffff');
    expect(labToHex([120, 0, 0])).toBe('#ffffff');
  });
});
