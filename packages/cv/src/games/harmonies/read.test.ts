import { describe, expect, it } from 'vitest';

import { draftFromReading, heightKey } from './draft';
import { detectSide, isCubePixel, SIDE_BACKGROUND, type BoardReading } from './read';

import { cvGame, HarmoniesLabelSchema } from './index';

describe('detectSide', () => {
  it('picks the side whose empty reference background is nearer, with the margin as confidence', () => {
    expect(detectSide([56, -3, 12.7]).side).toBe('A');
    expect(detectSide([56, -9.3, -6.2]).side).toBe('B');
    expect(detectSide(SIDE_BACKGROUND.A).confidence).toBe(1);
    // Halfway between the two references: no confidence either way.
    const [, aA, bA] = SIDE_BACKGROUND.A;
    const [, aB, bB] = SIDE_BACKGROUND.B;
    expect(detectSide([50, (aA + aB) / 2, (bA + bB) / 2]).confidence).toBeLessThan(0.01);
  });
});

describe('isCubePixel', () => {
  it('matches translucent amber, not field yellow, trunk brown, mountain gray or leaves', () => {
    expect(isCubePixel([45, 8, 30])).toBe(true);
    expect(isCubePixel([70, 10, 60])).toBe(false); // field: same hue, more saturated
    expect(isCubePixel([40, 14, 9])).toBe(false); // trunk: redder
    expect(isCubePixel([55, 0, -10])).toBe(false); // mountain
    expect(isCubePixel([55, -15, 28])).toBe(false); // leaves
  });
});

function reading(labels: Record<string, string>): BoardReading {
  return {
    side: 'A',
    sideConfidence: 0.8,
    spaces: Object.entries(labels).map(([key, label]) => ({
      key,
      label,
      confidence: 0.9,
      features: [0, 0, 0],
      cubeShare: 0,
    })),
  };
}

describe('draftFromReading', () => {
  it('HAR-STACK-1 to HAR-STACK-4: asks a height only where the top allows more than one token', () => {
    const draft = draftFromReading(
      reading({
        '0,0': 'W',
        '0,1': 'F',
        '0,2': 'M',
        '0,3': 'L',
        '0,4': 'T',
        '1,0': 'R',
        '1,1': 'empty',
        '1,2': 'occluded',
      }),
    );
    expect(draft.state).toEqual({
      side: 'A',
      stacks: {
        '0,0': ['W'],
        '0,1': ['F'],
        '0,2': ['M'],
        '0,3': ['L'],
        '0,4': ['T'],
        '1,0': ['R'],
      },
      animalCards: [],
    });
    const asked = Object.keys(draft.confidence).filter((key) => key.endsWith(':height'));
    expect(asked.sort()).toEqual(['0,2', '0,3', '0,4', '1,0'].map(heightKey).sort());
    for (const key of asked) expect(draft.confidence[key]).toBe(0);
    expect(draft.confidence.side).toBe(0.8);
    expect(draft.confidence['1,2']).toBe(0.9);
  });
});

describe('fixture labels', () => {
  it('maps a label to each space’s true class and the side', () => {
    const label = HarmoniesLabelSchema.parse({
      side: 'A',
      tops: { '0,0': 'L', '1,0': 'W' },
      cubes: ['0,0'],
      occluded: ['2,0'],
    });
    const truth = cvGame.cellTruth(label);
    expect(truth.side).toBe('A');
    expect(truth['0,0']).toBe('L');
    expect(truth['2,0']).toBe('occluded');
    expect(truth['0,1']).toBe('empty');
    expect(Object.keys(truth)).toHaveLength(24);
  });

  it('rejects spaces that are not on the side', () => {
    expect(
      HarmoniesLabelSchema.safeParse({ side: 'A', tops: { '6,0': 'W' }, occluded: [] }).success,
    ).toBe(false);
    expect(
      HarmoniesLabelSchema.safeParse({ side: 'B', tops: { '6,0': 'W' }, occluded: [] }).success,
    ).toBe(true);
  });
});
