import { describe, expect, it } from 'vitest';

import { calibrateProfile, classifyNearest, ProfileSchema, type Profile } from './profile';

const PROFILE: Profile = {
  version: 1,
  features: ['L', 'a'],
  tolerance: 2,
  classes: {
    dark: { centroid: [20, 0], spread: [4, 2], count: 10 },
    light: { centroid: [80, 0], spread: [4, 2], count: 10 },
  },
};

describe('classifyNearest', () => {
  it('picks the nearest class with high confidence when it is clear', () => {
    const result = classifyNearest([22, 1], PROFILE);
    expect(result.label).toBe('dark');
    expect(result.runnerUp.label).toBe('light');
    expect(result.confidence).toBeGreaterThan(0.9);
  });

  it('is unsure halfway between classes', () => {
    const result = classifyNearest([50, 0], PROFILE);
    expect(result.confidence).toBeLessThan(0.05);
  });

  it('loses confidence far beyond the tolerance even when one class is nearer', () => {
    const near = classifyNearest([22, 0], PROFILE);
    const far = classifyNearest([22, 30], PROFILE);
    expect(far.label).toBe('dark');
    expect(far.confidence).toBeLessThan(near.confidence / 3);
  });

  it('a wider tolerance raises confidence for distant values', () => {
    const strict = classifyNearest([22, 12], PROFILE, { tolerance: 1 });
    const loose = classifyNearest([22, 12], PROFILE, { tolerance: 10 });
    expect(loose.confidence).toBeGreaterThan(strict.confidence);
  });

  it('rejects a feature vector of the wrong length', () => {
    expect(() => classifyNearest([1], PROFILE)).toThrow();
  });
});

describe('calibrateProfile', () => {
  it('computes per-class centroids and spreads and a tolerance', () => {
    const samples = [
      { label: 'dark', features: [18, 1] },
      { label: 'dark', features: [22, -1] },
      { label: 'light', features: [78, 0] },
      { label: 'light', features: [82, 0] },
    ];
    const profile = calibrateProfile(samples, ['L', 'a']);
    expect(profile.classes.dark).toEqual({ centroid: [20, 0], spread: [2, 1], count: 2 });
    expect(profile.classes.light).toEqual({ centroid: [80, 0], spread: [2, 0], count: 2 });
    expect(profile.tolerance).toBeGreaterThanOrEqual(1);
    for (const sample of samples)
      expect(classifyNearest(sample.features, profile).label).toBe(sample.label);
  });

  it('needs at least 2 classes', () => {
    expect(() => calibrateProfile([{ label: 'only', features: [1] }], ['L'])).toThrow();
  });
});

describe('ProfileSchema', () => {
  it('rejects unknown features and bad versions', () => {
    expect(ProfileSchema.safeParse(PROFILE).success).toBe(true);
    expect(ProfileSchema.safeParse({ ...PROFILE, features: ['shine'] }).success).toBe(false);
    expect(ProfileSchema.safeParse({ ...PROFILE, version: 2 }).success).toBe(false);
  });
});
