import { describe, expect, it } from 'vitest';

import { isLowConfidence } from '@/components/confidence-outline';
import { detectionMeta } from '@/lib/session-store/detection-meta';

import { answerSpace, spaceConfidence } from './review';

// A side A draft like H2's: a confident mountain waiting for its height, an uncertain water space,
// a confident field, and the side.
const draft = {
  state: {
    side: 'A',
    stacks: { '2,-1': ['M'], '0,3': ['W'], '0,4': ['F'] },
    animalCards: [],
  },
  confidence: { side: 0.9, '2,-1': 0.95, '2,-1:height': 0, '0,3': 0.4, '0,4': 0.92 },
};

const lowCount = (confidence: Record<string, number>) =>
  Object.values(confidence).filter(isLowConfidence).length;

describe('harmonies review on the board', () => {
  it('outlines a space by the lower of its color and height confidence', () => {
    expect(spaceConfidence(draft.confidence)).toEqual({
      side: 0.9,
      '2,-1': 0,
      '0,3': 0.4,
      '0,4': 0.92,
    });
    expect(spaceConfidence(undefined)).toBeUndefined();
  });

  it('answering a space clears its highlight and its banner count, even with the same stack', () => {
    expect(lowCount(draft.confidence)).toBe(2);
    const once = answerSpace(draft.confidence, '2,-1');
    expect(once).toEqual({ ...draft.confidence, '2,-1': 1, '2,-1:height': 1 });
    expect(isLowConfidence(spaceConfidence(once)?.['2,-1'])).toBe(false);
    expect(lowCount(once)).toBe(1);
    const both = answerSpace(once, '0,3');
    expect(lowCount(both)).toBe(0);
    // A space the photo gave no keys for gains none.
    expect(Object.keys(answerSpace(both, '1,0'))).toEqual(Object.keys(draft.confidence));
  });

  it('D-037: detection_meta keeps the reading count and lists only changed stacks', () => {
    const confidence = answerSpace(answerSpace(draft.confidence, '2,-1'), '0,3');
    // The mountain is set to height 3; the water is confirmed as it was.
    const saved = { ...draft.state, stacks: { ...draft.state.stacks, '2,-1': ['M', 'M', 'M'] } };
    expect(detectionMeta({ state: draft.state, confidence }, saved)).toEqual({
      corrected: ['stacks.2,-1.1', 'stacks.2,-1.2'],
      detected: 5,
    });
  });
});
