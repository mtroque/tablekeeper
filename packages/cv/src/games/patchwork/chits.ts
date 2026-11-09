import type { ImageInput, Quad } from '@tablekeeper/core';
import { z } from 'zod';

import { loadImage } from '../../pipeline/load-image';
import { matchTemplateRotInvariant, type TemplateRef } from '../../pipeline/match';
import { getCv, type Mat } from '../../pipeline/opencv';
import { warpToCanonical } from '../../pipeline/warp';

import { findChitRegions, type ChitRegion } from './chit-regions';

// Praline chits (PAT-SCORE-4) and the special tile beside the box board (docs/games/patchwork.md →
// Photo reading). Gold 1 chits are counted by area; the purple 5, 10 and 20 chits and the special
// tile are told apart by template matching against the reference crops, helped by their shape.

export const CHIT_KINDS = ['one', 'five', 'ten', 'twenty'] as const;
export type ChitKind = (typeof CHIT_KINDS)[number];
/** What a template can be: a purple chit or the special tile. */
const TEMPLATE_KINDS = ['five', 'ten', 'twenty', 'special'] as const;
type TemplateKind = (typeof TEMPLATE_KINDS)[number];

/** How many of each the game has (PAT-SCORE-4); more than this is a misreading. */
const IN_THE_BOX: Record<ChitKind, number> = { one: 32, five: 12, ten: 5, twenty: 1 };

/** Side of the upright crops compared with the templates. */
export const TEMPLATE_SIZE = { width: 40, height: 48 } as const;

const TemplateSchema = z.object({
  kind: z.enum(TEMPLATE_KINDS),
  name: z.string(),
  /** Gray levels, row by row, `TEMPLATE_SIZE`. */
  pixels: z.array(z.int().min(0).max(255)).length(TEMPLATE_SIZE.width * TEMPLATE_SIZE.height),
});

/** `chits.json`: upright crops of each reference chit and of the special tile. */
export const ChitTemplatesSchema = z.object({
  version: z.literal(1),
  size: z.object({
    width: z.literal(TEMPLATE_SIZE.width),
    height: z.literal(TEMPLATE_SIZE.height),
  }),
  templates: z.array(TemplateSchema).min(1),
});
export type ChitTemplates = z.infer<typeof ChitTemplatesSchema>;

/** Reference crops: `token-5-a.jpg`, `special-tile-b.jpg` and so on (docs/DATA_ASSETS.md). */
const TEMPLATE_NAME = /(?:^|\/)(token-(5|10|20)|special-tile)-[a-z]\.jpe?g$/;
const TEMPLATE_KIND_BY_VALUE: Record<string, TemplateKind> = {
  '5': 'five',
  '10': 'ten',
  '20': 'twenty',
};

/** Gold (b*) above this is a 1 chit; the purple chits and the special tile sit well below. */
const GOLD_B = 12;
/** A 1 chit's area over the board's, when no lone 1 chit shows it (measured 0.0042 to 0.0052). */
const ONE_AREA = 0.0047;
/** The special tile covers 0.040 to 0.047 of the board's area, a purple chit 0.012 to 0.022. */
const SPECIAL_MIN_AREA = 0.03;
const CHIT_MIN_AREA = 0.009;
const SPECIAL_MAX_AREA = 0.06;
/** Long over short side: a 5 chit is about 1.2, a 10 chit 1.45 to 1.7, a 20 chit 1.1. */
const LONG_CHIT = 1.4;
const SQUARE_CHIT = 1.15;
/** How much a matching or contradicting shape adds to a template score. */
const SHAPE_WEIGHT = 0.15;
/** Below this template score nothing is recognized. */
const MIN_MATCH = 0.35;
/** A region filling less of its rectangle than this is likely chits run together or cut short. */
const MIN_FILL = 0.72;
/** Confidence given to every count when a region can't be read. */
const UNREAD = 0.3;

export const CHITS_UNREAD =
  'Some praline chits are touching or hidden. Check the counts, or spread them out and retake the photo.';

export type ChitReading = {
  tokens: Record<ChitKind, number>;
  specialTile: boolean;
  /** Per count and for the special tile, 0 to 1. */
  confidence: Record<ChitKind | 'specialTile', number>;
  warnings: string[];
};

/** One region and what it was read as. */
type Reading =
  | { kind: 'one'; count: number; confidence: number }
  | { kind: TemplateKind; count: 1; confidence: number; runnerUp?: TemplateKind }
  | { kind: 'unknown' };

/**
 * Reads the chits and the special tile beside the board in an RGB image (`board` in its pixels).
 * Every region is a chit, a few touching 1 chits, the special tile, or unread; an unread region
 * lowers the confidence of every count, since it could be any of them.
 */
export function readChits(mat: Mat, board: Quad, templates: ChitTemplates): ChitReading {
  const regions = findChitRegions(mat, { board });
  const refs = templateMats(templates);
  try {
    const gold = regions.filter((region) => region.lab[2] > GOLD_B);
    const lone = gold
      .filter((r) => r.circularity > 0.85 && r.relativeArea < 2 * ONE_AREA && !r.split)
      .map((r) => r.relativeArea)
      .sort((p, q) => p - q);
    const oneArea = lone.length ? (lone[Math.floor(lone.length / 2)] as number) : ONE_AREA;
    const readings = regions.map((region) =>
      region.lab[2] > GOLD_B ? readGold(region, oneArea) : readPurple(mat, region, refs),
    );
    return tally(readings);
  } finally {
    for (const ref of refs) ref.mat.delete();
  }
}

/** Touching 1 chits that didn't split are counted by area. */
function readGold(region: ChitRegion, oneArea: number): Reading {
  const ratio = region.relativeArea / oneArea;
  if (ratio < 0.5) return { kind: 'unknown' };
  const count = Math.max(1, Math.round(ratio));
  // Confidence 1 within 0.15 of a whole number of chits, 0.5 at 0.3, falling to 0 at 0.5 off.
  const off = Math.abs(ratio - count);
  return { kind: 'one', count, confidence: clamp01(1 - Math.max(0, off - 0.15) / 0.3) };
}

function readPurple(mat: Mat, region: ChitRegion, refs: TemplateRef[]): Reading {
  const area = region.relativeArea;
  if (area < CHIT_MIN_AREA || area > SPECIAL_MAX_AREA) return { kind: 'unknown' };
  const special = area >= SPECIAL_MIN_AREA;
  const candidates = refs.filter((ref) => (ref.key === 'special') === special);
  if (!candidates.length) return { kind: 'unknown' };
  const crop = warpToCanonical(mat, region.quad, TEMPLATE_SIZE);
  const match = matchTemplateRotInvariant(crop, candidates, { angleStep: 90 });
  crop.delete();

  const scored = Object.entries(match.scores)
    .map(([key, score]) => ({
      kind: key as TemplateKind,
      match: score,
      score: score + shapeBonus(key as TemplateKind, region.aspect),
    }))
    .sort((p, q) => q.score - p.score);
  const best = scored[0];
  if (!best || best.match < MIN_MATCH) return { kind: 'unknown' };
  const second = scored[1];
  // The special tile stands alone in its size; a chit is 0.5 sure at an even score and 1 at a
  // 0.15 lead.
  let confidence = second ? clamp01(0.5 + (best.score - second.score) / 0.3) : 1;
  if (region.fill < MIN_FILL || best.match < 0.5) confidence = Math.min(confidence, 0.5);
  return {
    kind: best.kind,
    count: 1,
    confidence,
    ...(second ? { runnerUp: second.kind } : {}),
  };
}

/** Long chits are 10s, nearly square ones 20s, the rest 5s. */
function shapeBonus(kind: TemplateKind, aspect: number): number {
  switch (kind) {
    case 'five':
      return aspect < LONG_CHIT ? SHAPE_WEIGHT : -SHAPE_WEIGHT;
    case 'ten':
      return aspect >= LONG_CHIT ? SHAPE_WEIGHT : -SHAPE_WEIGHT;
    case 'twenty':
      return aspect < SQUARE_CHIT ? SHAPE_WEIGHT : -SHAPE_WEIGHT;
    case 'special':
      return 0;
  }
}

function tally(readings: Reading[]): ChitReading {
  const tokens: Record<ChitKind, number> = { one: 0, five: 0, ten: 0, twenty: 0 };
  const confidence: ChitReading['confidence'] = {
    one: 1,
    five: 1,
    ten: 1,
    twenty: 1,
    specialTile: 1,
  };
  const field = (kind: TemplateKind | 'one'): ChitKind | 'specialTile' =>
    kind === 'special' ? 'specialTile' : kind;
  const lower = (key: ChitKind | 'specialTile', value: number) => {
    confidence[key] = Math.min(confidence[key], value);
  };
  let specials = 0;
  let unread = false;
  for (const reading of readings) {
    if (reading.kind === 'unknown') {
      unread = true;
      for (const key of Object.keys(confidence) as Array<keyof typeof confidence>) {
        lower(key, UNREAD);
      }
      continue;
    }
    if (reading.kind === 'special') specials++;
    else tokens[reading.kind] += reading.count;
    lower(field(reading.kind), reading.confidence);
    // A doubtful chit may be the runner-up instead, so that count is doubtful too.
    if ('runnerUp' in reading) {
      lower(field(reading.runnerUp), reading.confidence);
    }
  }
  for (const kind of CHIT_KINDS) {
    if (tokens[kind] > IN_THE_BOX[kind]) lower(kind, UNREAD);
  }
  if (specials > 1) lower('specialTile', UNREAD);
  for (const key of Object.keys(confidence) as Array<keyof typeof confidence>) {
    confidence[key] = Math.round(confidence[key] * 1000) / 1000;
  }
  return { tokens, specialTile: specials > 0, confidence, warnings: unread ? [CHITS_UNREAD] : [] };
}

function templateMats(templates: ChitTemplates): TemplateRef[] {
  const cv = getCv();
  const { width, height } = TEMPLATE_SIZE;
  return templates.templates.map((template) => ({
    key: template.kind,
    mat: cv.matFromArray(
      height,
      width,
      cv.CV_8UC3,
      template.pixels.flatMap((v) => [v, v, v]),
    ),
  }));
}

/**
 * Builds `chits.json` from the reference crops (each the largest region in its photo, cropped
 * upright). Undefined when there are none, so a calibration without them keeps the committed file.
 */
export function buildChitTemplates(
  references: Array<{ name: string; image: ImageInput; orientation?: number }>,
): ChitTemplates | undefined {
  const cv = getCv();
  const templates: ChitTemplates['templates'] = [];
  for (const ref of references) {
    const name = TEMPLATE_NAME.exec(ref.name);
    if (!name) continue;
    const kind = name[2] ? TEMPLATE_KIND_BY_VALUE[name[2]] : 'special';
    if (!kind) continue;
    const { mat } = loadImage(ref.image, {
      maxSide: 1600,
      ...(ref.orientation === undefined ? {} : { orientation: ref.orientation }),
    });
    try {
      const [region] = findChitRegions(mat, { minArea: 0.02 });
      if (!region) throw new Error(`No chit found in the reference ${ref.name}`);
      const crop = warpToCanonical(mat, region.quad, TEMPLATE_SIZE);
      const gray = new cv.Mat();
      cv.cvtColor(crop, gray, cv.COLOR_RGB2GRAY);
      crop.delete();
      templates.push({ kind, name: ref.name, pixels: Array.from(gray.data) });
      gray.delete();
    } finally {
      mat.delete();
    }
  }
  if (!templates.length) return undefined;
  templates.sort((p, q) => p.name.localeCompare(q.name));
  return { version: 1, size: TEMPLATE_SIZE, templates };
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
