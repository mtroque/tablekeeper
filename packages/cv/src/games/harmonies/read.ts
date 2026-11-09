import type { HarmoniesSide, Quad } from '@tablekeeper/core';

import { rgbToLab } from '../../pipeline/features';
import { pointInPolygon } from '../../pipeline/geometry';
import { classifyNearest, type Profile } from '../../pipeline/profile';

import { canonicalSize, flattenBoard, hexCenters, type Pixels } from './geometry';
import { SIDES } from './layout';
import { outlineModel } from './outline-fit';

// Reads a board at known corners in plain TypeScript (no opencv), so the review screen can
// reread the photo as the other side on the main thread (D-064).

/** Width the board is flattened to; a hex is then about 44 pixels from center to corner. */
export const READ_WIDTH = 600;

/**
 * Radius of the disc sampled at each space, as a share of the hex size (center to corner): a
 * little smaller than the printed hex, so a leaning stack doesn't pull in a neighbor's color,
 * but wide enough to see the token's color around an animal cube.
 */
export const SAMPLE_RADIUS = 0.65;

/** Profile classes: a top token code, or an empty space. */
export const EMPTY = 'empty';
/** The top color can't be seen at all (set by rule, not by the profile). */
export const OCCLUDED = 'occluded';
export const TOP_CLASSES = ['W', 'F', 'M', 'T', 'L', 'R', EMPTY] as const;

export type Lab = [number, number, number];

/**
 * Board background (median CIELAB outside every space of both sides) of the two empty
 * references, `data/fixtures/harmonies/references/side-a.jpg` and `side-b.jpg`, flattened at
 * `SIDE_REFERENCE_CORNERS` (found by `findHarmoniesBoard`). `side-reference.test.ts` recomputes
 * them from the photos.
 */
export const SIDE_BACKGROUND: Record<HarmoniesSide, Lab> = {
  A: [50.55, 0.36, 9.22],
  B: [51.56, -5.92, -10.93],
};

export const SIDE_REFERENCE_CORNERS: Record<HarmoniesSide, Quad> = {
  A: [
    { x: 59, y: 152 },
    { x: 1495, y: 125 },
    { x: 1495, y: 1260 },
    { x: 105, y: 1285 },
  ],
  B: [
    { x: 130, y: 90 },
    { x: 1429, y: 89 },
    { x: 1439, y: 1121 },
    { x: 137, y: 1143 },
  ],
};

let backgroundMask: Int32Array | undefined;

/**
 * Pixel indexes of the flattened board's background: inside the outline (pulled in 6% from the
 * edge, so a corner error doesn't take in the table), away from every space of either side.
 */
function background(): Int32Array {
  if (backgroundMask) return backgroundMask;
  const { width, height } = canonicalSize(READ_WIDTH);
  const outline = outlineModel(0.01).map((p) => ({
    x: width / 2 + (p.u * width - width / 2) * 0.94,
    y: height / 2 + (p.v * height - height / 2) * 0.94,
  }));
  const spaces = SIDES.flatMap((side) => hexCenters(side, READ_WIDTH).centers);
  const keepOut = (1.05 * hexCenters('A', READ_WIDTH).size) ** 2;
  const indexes: number[] = [];
  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
      if (!pointInPolygon(x, y, outline)) continue;
      if (spaces.some((c) => (c.x - x) ** 2 + (c.y - y) ** 2 < keepOut)) continue;
      indexes.push(y * width + x);
    }
  }
  backgroundMask = Int32Array.from(indexes);
  return backgroundMask;
}

/** Median CIELAB of the flattened board's background (`READ_WIDTH` wide). */
export function boardBackground(flat: Pixels): Lab {
  const labs = Array.from(background(), (i) => labAt(flat, i));
  return medianLab(labs);
}

/**
 * The side whose empty reference's background color is nearer the photo's, by CIELAB a and b
 * (lightness varies most with the room's light). Confidence is the margin to the other side.
 */
export function detectSide(bg: Lab): { side: HarmoniesSide; confidence: number } {
  const distance = (side: HarmoniesSide) =>
    Math.hypot(bg[1] - SIDE_BACKGROUND[side][1], bg[2] - SIDE_BACKGROUND[side][2]);
  const a = distance('A');
  const b = distance('B');
  const side: HarmoniesSide = a <= b ? 'A' : 'B';
  const near = Math.min(a, b);
  const far = Math.max(a, b);
  return { side, confidence: far > 0 ? round((far - near) / far) : 0 };
}

/**
 * An animal cube's pixel: translucent amber, CIELAB hue 50 to 100 degrees at low to medium
 * chroma. Field tokens are the same hue but more saturated; trunks are redder.
 */
export function isCubePixel([, a, b]: Lab): boolean {
  const chroma = Math.hypot(a, b);
  if (chroma <= 8 || chroma >= 45) return false;
  const hue = (Math.atan2(b, a) * 180) / Math.PI;
  return hue > 50 && hue < 100;
}

/** Below this share of a disc's pixels left after removing the cube, the top can't be seen. */
const MIN_VISIBLE = 0.1;

export type SpaceMeasure = {
  key: string;
  /** Median L, a, b of the visible top, corrected for the photo's light (`profile.features`). */
  features: number[];
  /** Share of the disc that looks like an animal cube. */
  cubeShare: number;
};

export type BoardMeasure = {
  side: HarmoniesSide;
  /** 1 when the side was given. */
  sideConfidence: number;
  spaces: SpaceMeasure[];
};

/**
 * Measures every space of a board photo at known corners (original-image pixels, the board
 * rectangle's TL, TR, BR, BL). The side is detected unless given. Colors are corrected by the
 * difference between the photo's board background and that side's empty reference, so the room's
 * light matters less.
 */
export function measureBoard(
  image: Pixels,
  corners: Quad,
  opts: { side?: HarmoniesSide } = {},
): BoardMeasure {
  const flat = flattenBoard(image, corners, READ_WIDTH);
  const bg = boardBackground(flat);
  const detected = detectSide(bg);
  const side = opts.side ?? detected.side;
  const ref = SIDE_BACKGROUND[side];
  const { centers, size } = hexCenters(side, READ_WIDTH);
  const radius = SAMPLE_RADIUS * size;
  const spaces = centers.map(({ key, x: cx, y: cy }) => {
    const all: Lab[] = [];
    for (let y = Math.floor(cy - radius); y <= cy + radius; y++) {
      for (let x = Math.floor(cx - radius); x <= cx + radius; x++) {
        if ((x - cx) ** 2 + (y - cy) ** 2 > radius * radius) continue;
        if (x < 0 || y < 0 || x >= flat.width || y >= flat.height) continue;
        all.push(labAt(flat, y * flat.width + x));
      }
    }
    const visible = all.filter((lab) => !isCubePixel(lab));
    const cubeShare = all.length ? 1 - visible.length / all.length : 1;
    // A disc almost all cube-colored is read as occluded (`readBoard`); its features still come
    // from every pixel so a calibration can use it.
    const [L, a, b] = medianLab(visible.length >= MIN_VISIBLE * all.length ? visible : all);
    const features = [L * (ref[0] / Math.max(1, bg[0])), a + ref[1] - bg[1], b + ref[2] - bg[2]];
    return { key, features: features.map(round), cubeShare: round(cubeShare) };
  });
  return {
    side,
    sideConfidence: opts.side ? 1 : detected.confidence,
    spaces,
  };
}

export type SpaceReading = SpaceMeasure & { label: string; confidence: number };
export type BoardReading = Omit<BoardMeasure, 'spaces'> & { spaces: SpaceReading[] };

/** `measureBoard`, then each space classified against the profile. */
export function readBoard(
  image: Pixels,
  corners: Quad,
  profile: Profile,
  opts: { side?: HarmoniesSide } = {},
): BoardReading {
  const measured = measureBoard(image, corners, opts);
  return {
    ...measured,
    spaces: measured.spaces.map((space) => {
      if (space.cubeShare > 1 - MIN_VISIBLE) {
        return { ...space, label: OCCLUDED, confidence: 0 };
      }
      const { label, confidence } = classifyNearest(space.features, profile);
      return { ...space, label, confidence: round(confidence) };
    }),
  };
}

function labAt(flat: Pixels, index: number): Lab {
  const i = index * flat.channels;
  return rgbToLab(flat.data[i] as number, flat.data[i + 1] as number, flat.data[i + 2] as number);
}

function medianLab(labs: readonly Lab[]): Lab {
  const median = (k: 0 | 1 | 2) => {
    const sorted = labs.map((lab) => lab[k]).sort((x, y) => x - y);
    return sorted[sorted.length >> 1] ?? 0;
  };
  return [median(0), median(1), median(2)];
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
