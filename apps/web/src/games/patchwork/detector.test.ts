import { describe, expect, it } from 'vitest';

import { findDetector } from '../detectors';

describe('patchwork detector loader', () => {
  it('is found by the worker lookup and loads a detector', async () => {
    const load = findDetector('patchwork');
    expect(load).toBeTypeOf('function');
    await expect(load?.()).resolves.toHaveProperty('detect');
  });
});
