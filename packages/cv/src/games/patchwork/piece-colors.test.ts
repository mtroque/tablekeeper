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
  type MeasuredColors,
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

/**
 * Pieces labeled by eye from the photos, by the color of the piece around its pralines: in
 * `02-red-wood-table.jpg` the purple piece with raspberry pralines at the top and the yellow
 * green piece with silver pralines at the top right; in `01-red-white-table.jpg` the blue piece
 * with cookies at the top left, the green piece below it and the teal piece with purple dotted
 * squares.
 */
const KNOWN_PIECES: Array<{
  fixture: string;
  row: number;
  col: number;
  piece: string;
  is: (lab: Lab) => boolean;
}> = [
  { fixture: '02-red', row: 0, col: 3, piece: 'purple', is: ([, a, b]) => a > 10 && b < -15 },
  { fixture: '02-red', row: 1, col: 7, piece: 'yellow green', is: ([, a, b]) => b > 15 && a < 0 },
  { fixture: '01-red', row: 1, col: 0, piece: 'blue', is: ([, a, b]) => b < -15 && a < 5 },
  { fixture: '01-red', row: 3, col: 1, piece: 'green', is: ([, a, b]) => a < -5 && b > 0 },
  { fixture: '01-red', row: 1, col: 5, piece: 'teal', is: ([, a, b]) => a < -5 && b < 0 },
];

const median = (values: number[]) =>
  values.sort((p, q) => p - q)[Math.floor(values.length / 2)] ?? 0;
/** Median distance between two readings of the same spaces, over the given LAB channels. */
const change = (a: Lab[], b: Lab[], channels = [0, 1, 2]) =>
  median(a.map((lab, i) => Math.hypot(...channels.map((k) => (lab[k] ?? 0) - (b[i]?.[k] ?? 0)))));

/** The photo with each RGB byte scaled per channel. */
function relit(image: ImageInput, factors: [number, number, number]): ImageInput {
  const data = new Uint8ClampedArray(image.data.length);
  image.data.forEach((v, i) => {
    data[i] = i % 4 === 3 ? v : v * (factors[i % 4] ?? 1);
  });
  return { ...image, data };
}

describe('measureSpaceColors', () => {
  it('reads 81 colors from a fixture, and known pieces in their own colors', () => {
    for (const name of ['02-red', '01-red']) {
      const fixture = fixtures.find((f) => f.image.includes(name));
      if (!fixture) throw new Error(`Fixture ${name} is missing`);
      const image =
        fixture === redWood ? redWoodPhoto : photo(`data/fixtures/patchwork/${fixture.image}`);
      const colors = spaceColors(
        measureSpaceColors(image, fixture.corners),
        fixture.label.board,
        cvGame.references,
      );
      expect(colors).toHaveLength(81);
      for (const color of colors) expect(color.hex).toMatch(/^#[0-9a-f]{6}$/);
      for (const known of KNOWN_PIECES.filter((k) => k.fixture === name)) {
        const color = colors[known.row * 9 + known.col];
        expect(
          color && known.is(color.lab),
          `${known.piece} at ${known.row},${known.col} in ${name}`,
        ).toBe(true);
      }
    }
  });

  it('corrects for the light: a warm cast is taken out by the frame', () => {
    const plain = measureSpaceColors(redWoodPhoto, redWood.corners);
    const warm = measureSpaceColors(relit(redWoodPhoto, [1, 0.85, 0.65]), redWood.corners);
    const corrected = (m: MeasuredColors) =>
      spaceColors(m, 'red', cvGame.references).map((c) => c.lab);
    // The hue (a* and b*); lightness is only half corrected, as the next test shows.
    const raw = change(plain.rings, warm.rings, [1, 2]);
    const fixed = change(corrected(plain), corrected(warm), [1, 2]);
    expect(raw).toBeGreaterThan(10);
    expect(fixed).toBeLessThan(raw * 0.3);
  });

  it('corrects half the brightness: a dimmer photo comes out a little dimmer', () => {
    // The gray board photo's frame is near the references' light, so the gain isn't capped.
    const fixture = fixtures.find((f) => f.image.includes('06-gray'));
    if (!fixture) throw new Error('Fixture 06 is missing');
    const image = photo(`data/fixtures/patchwork/${fixture.image}`);
    const plain = measureSpaceColors(image, fixture.corners);
    const dim = measureSpaceColors(relit(image, [0.75, 0.75, 0.75]), fixture.corners);
    const corrected = (m: MeasuredColors) =>
      spaceColors(m, 'gray', cvGame.references).map((c) => c.lab);
    const raw = change(plain.rings, dim.rings);
    const fixed = change(corrected(plain), corrected(dim));
    // The brightness gain is softened to its square root (a frame in shadow would otherwise wash
    // every piece out), so about half the change stays.
    expect(raw).toBeGreaterThan(8);
    expect(fixed).toBeLessThan(raw * 0.7);
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
    // Measured at LOOKS_EMPTY_DISTANCE 5: 65 of 82 empty, 14 of 566 covered (11 of them on the
    // glare photo, 06).
    expect(LOOKS_EMPTY_DISTANCE).toBe(5);
    expect(emptyFlagged / empty).toBeGreaterThan(0.75);
    expect(coveredFlagged / covered).toBeLessThan(0.03);
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
