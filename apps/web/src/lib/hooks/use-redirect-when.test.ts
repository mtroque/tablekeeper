import { beforeEach, describe, expect, it, vi } from 'vitest';

const replace = vi.fn();
const push = vi.fn();

type Cleanup = (() => void) | undefined;
type EffectEntry = { effect: () => Cleanup; deps: unknown[] | undefined; cleanup: Cleanup };

const hookState = {
  refs: [] as Array<{ current: unknown }>,
  refIndex: 0,
  effects: [] as EffectEntry[],
  effectIndex: 0,
};

function resetHooks() {
  hookState.refs = [];
  hookState.refIndex = 0;
  hookState.effects = [];
  hookState.effectIndex = 0;
}

function depsChanged(prev: unknown[] | undefined, next: unknown[] | undefined): boolean {
  if (!prev || !next) return true;
  if (prev.length !== next.length) return true;
  return next.some((dep, i) => !Object.is(dep, prev[i]));
}

function runRender(renderFn: () => void, { strict = false } = {}) {
  hookState.refIndex = 0;
  hookState.effectIndex = 0;
  renderFn();
  for (const entry of hookState.effects) {
    entry.cleanup = entry.effect();
    if (strict) {
      if (typeof entry.cleanup === 'function') entry.cleanup();
      entry.cleanup = entry.effect();
    }
  }
}

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push }),
}));

vi.mock('react', () => ({
  useRef: (initial: unknown) => {
    const idx = hookState.refIndex++;
    if (!hookState.refs[idx]) {
      hookState.refs[idx] = { current: initial };
    }
    return hookState.refs[idx];
  },
  useEffect: (effect: () => Cleanup, deps?: unknown[]) => {
    const idx = hookState.effectIndex++;
    const prev = hookState.effects[idx];
    if (!prev || depsChanged(prev.deps, deps)) {
      if (prev && typeof prev.cleanup === 'function') prev.cleanup();
      hookState.effects[idx] = { effect, deps, cleanup: undefined };
    }
  },
}));

import { useRedirectWhen } from './use-redirect-when';

describe('useRedirectWhen', () => {
  beforeEach(() => {
    resetHooks();
    replace.mockReset();
    push.mockReset();
  });

  it('redirects once when the condition turns true, not before, with replace', () => {
    let condition = false;
    const Subject = () => {
      useRedirectWhen(condition, '/games/azul/score');
    };

    runRender(Subject);
    expect(replace).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();

    condition = true;
    runRender(Subject);
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith('/games/azul/score');
    expect(push).not.toHaveBeenCalled();

    // Re-rendering while still true does not redirect again.
    runRender(Subject);
    expect(replace).toHaveBeenCalledTimes(1);
  });

  it('redirects only once under Strict Mode', () => {
    runRender(
      () => {
        useRedirectWhen(true, '/games/patchwork/score');
      },
      { strict: true },
    );

    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith('/games/patchwork/score');
  });

  it('redirects again if the condition resets to false and turns true later', () => {
    let condition = true;
    const Subject = () => {
      useRedirectWhen(condition, '/games/azul/score');
    };

    runRender(Subject);
    expect(replace).toHaveBeenCalledTimes(1);

    condition = false;
    runRender(Subject);
    expect(replace).toHaveBeenCalledTimes(1);

    condition = true;
    runRender(Subject);
    expect(replace).toHaveBeenCalledTimes(2);
  });
});
