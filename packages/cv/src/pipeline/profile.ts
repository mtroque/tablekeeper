import { z } from 'zod';

import { FEATURE_NAMES } from './features';

/** A calibration profile (`games/<gameId>/profile.json`), built by `pnpm eval:cv <gameId> --calibrate`. */
export const ProfileSchema = z.object({
  version: z.literal(1),
  features: z.array(z.enum(FEATURE_NAMES)).min(1),
  /** Spread-scaled distance up to which a match is fully trusted. */
  tolerance: z.number().positive(),
  classes: z
    .record(
      z.string(),
      z.object({
        centroid: z.array(z.number()),
        spread: z.array(z.number().nonnegative()),
        count: z.number().int().positive(),
      }),
    )
    .refine((classes) => Object.keys(classes).length >= 2, 'A profile needs at least 2 classes'),
});
export type Profile = z.infer<typeof ProfileSchema>;

export type Classification = {
  label: string;
  /** 0 to 1. */
  confidence: number;
  /** Spread-scaled distance to the chosen class. */
  distance: number;
  /** The second nearest class and its distance. */
  runnerUp: { label: string; distance: number };
};

/** Spreads below this are raised to it, so one tight class doesn't dominate the distance. */
const MIN_SPREAD = 1;

/**
 * Nearest calibrated class by spread-scaled distance (root mean square of per-feature z-scores).
 * Confidence is the margin to the runner-up, `(d2 - d1) / d2`, times a falloff once the distance
 * passes the tolerance. Never exact matching.
 */
export function classifyNearest(
  features: readonly number[],
  profile: Profile,
  opts: { tolerance?: number } = {},
): Classification {
  const tolerance = opts.tolerance ?? profile.tolerance;
  const ranked = Object.entries(profile.classes)
    .map(([label, cls]) => ({
      label,
      distance: scaledDistance(features, cls.centroid, cls.spread),
    }))
    .sort((a, b) => a.distance - b.distance);
  const [first, second] = ranked;
  if (!first || !second) throw new Error('A profile needs at least 2 classes');
  const margin = second.distance > 0 ? (second.distance - first.distance) / second.distance : 0;
  const falloff = first.distance <= tolerance ? 1 : tolerance / first.distance;
  return {
    label: first.label,
    confidence: clamp01(margin * falloff),
    distance: first.distance,
    runnerUp: second,
  };
}

export function scaledDistance(
  features: readonly number[],
  centroid: readonly number[],
  spread: readonly number[],
): number {
  if (features.length !== centroid.length) {
    throw new Error(`Expected ${centroid.length} features, got ${features.length}`);
  }
  let sum = 0;
  features.forEach((value, i) => {
    const z = (value - (centroid[i] as number)) / Math.max(MIN_SPREAD, spread[i] ?? 0);
    sum += z * z;
  });
  return Math.sqrt(sum / features.length);
}

/**
 * Builds a profile from labeled feature vectors: per-class mean and standard deviation, and a
 * tolerance of 1.5 times the 95th percentile of the samples' distances to their own class.
 */
export function calibrateProfile(
  samples: ReadonlyArray<{ label: string; features: readonly number[] }>,
  featureNames: Profile['features'],
): Profile {
  const groups = new Map<string, Array<readonly number[]>>();
  for (const sample of samples) {
    if (sample.features.length !== featureNames.length) {
      throw new Error(`Expected ${featureNames.length} features, got ${sample.features.length}`);
    }
    groups.set(sample.label, [...(groups.get(sample.label) ?? []), sample.features]);
  }
  const classes: Profile['classes'] = {};
  for (const [label, vectors] of [...groups].sort(([a], [b]) => a.localeCompare(b))) {
    const centroid = featureNames.map((_, i) => mean(vectors.map((v) => v[i] as number)));
    const spread = featureNames.map((_, i) => {
      const m = centroid[i] as number;
      return Math.sqrt(mean(vectors.map((v) => ((v[i] as number) - m) ** 2)));
    });
    classes[label] = {
      centroid: centroid.map(round),
      spread: spread.map(round),
      count: vectors.length,
    };
  }
  const distances = samples
    .map((s) => {
      const cls = classes[s.label];
      return cls ? scaledDistance(s.features, cls.centroid, cls.spread) : 0;
    })
    .sort((a, b) => a - b);
  const p95 = distances[Math.min(distances.length - 1, Math.floor(distances.length * 0.95))] ?? 1;
  return ProfileSchema.parse({
    version: 1,
    features: featureNames,
    tolerance: round(Math.max(1, 1.5 * p95)),
    classes,
  });
}

function mean(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, v) => sum + v, 0) / values.length;
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
