import { beforeAll, describe, expect, it } from 'vitest';

import { loadOpenCvInNode } from '../../node';
import { FixtureSetSchema } from '../../pipeline/fixtures';
import { cornerError } from '../../pipeline/geometry';

import { flattenBoard } from './geometry';
import { SIDES } from './layout';
import {
  boardBackground,
  measureBoard,
  READ_WIDTH,
  SIDE_BACKGROUND,
  SIDE_REFERENCE_CORNERS,
} from './read';
import { fixtureLabels, fixturePhoto, toQuad } from './test-photos';

import { cvGame, HarmoniesLabelSchema } from './index';

// Accuracy is measured by `pnpm eval:cv harmonies`; these check the pieces it relies on against
// the real photos.

const fixtures = FixtureSetSchema.parse(fixtureLabels());

beforeAll(async () => {
  await loadOpenCvInNode();
});

describe('harmonies references', () => {
  it.each(SIDES)('side %s: the committed background matches references/side-%s.jpg', (side) => {
    const photo = fixturePhoto(`references/side-${side.toLowerCase()}.jpg`);
    const flat = flattenBoard({ ...photo, channels: 4 }, SIDE_REFERENCE_CORNERS[side], READ_WIDTH);
    const measured = boardBackground(flat);
    measured.forEach((value, i) => {
      expect(Math.abs(value - (SIDE_BACKGROUND[side][i] ?? 0))).toBeLessThan(0.5);
    });
  });
});

describe('harmonies fixtures', () => {
  it.each(fixtures.items.map((item) => [item.image, item] as const))(
    '%s: the side is detected at the labeled corners',
    (_name, item) => {
      const label = HarmoniesLabelSchema.parse(item.label);
      if (!item.corners) throw new Error('Harmonies fixtures have corners');
      const photo = fixturePhoto(item.image);
      const measured = measureBoard({ ...photo, channels: 4 }, toQuad(item.corners));
      expect(measured.side).toBe(label.side);
      expect(measured.sideConfidence).toBeGreaterThan(0.5);
    },
  );

  it.each(fixtures.items.map((item) => [item.image, item] as const))(
    '%s: the board is found without corners',
    async (_name, item) => {
      if (!item.corners) throw new Error('Harmonies fixtures have corners');
      const draft = await cvGame.detector.detect(fixturePhoto(item.image));
      expect(draft.warnings).toEqual([]);
      expect(cornerError(draft.corners, toQuad(item.corners))).toBeLessThan(0.03);
    },
    20_000,
  );
});
