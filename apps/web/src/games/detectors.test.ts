import { afterEach, describe, expect, it, vi } from 'vitest';

import { findDetector } from './detectors';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('findDetector', () => {
  it('finds the example detector outside production', async () => {
    const load = findDetector('_example');
    expect(load).toBeTypeOf('function');
    const detector = await load!();
    expect(detector.detect).toBeTypeOf('function');
  });

  it('hides the example detector in production unless the example game is enabled', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_ENABLE_EXAMPLE_GAME', 'false');
    expect(findDetector('_example')).toBeUndefined();
    vi.stubEnv('NEXT_PUBLIC_ENABLE_EXAMPLE_GAME', 'true');
    expect(findDetector('_example')).toBeTypeOf('function');
  });

  it('has no detector for games without one yet or for unknown ids', () => {
    expect(findDetector('azul')).toBeUndefined();
    expect(findDetector('dorfromantik')).toBeUndefined();
    expect(findDetector('chess')).toBeUndefined();
  });
});
