import { beforeEach, describe, expect, it, vi } from 'vitest';

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

function mount(renderFn: () => void, { strict = false } = {}) {
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
  return () => {
    for (const entry of hookState.effects) {
      if (typeof entry.cleanup === 'function') entry.cleanup();
    }
  };
}

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
    if (!hookState.effects[idx]) {
      hookState.effects[idx] = { effect, deps, cleanup: undefined };
    }
  },
}));

import { useOnMount } from './use-on-mount';

describe('useOnMount', () => {
  beforeEach(() => {
    resetHooks();
  });

  it('runs once under Strict Mode and keeps the signal un-aborted', async () => {
    const signals: AbortSignal[] = [];
    const task = vi.fn((signal: AbortSignal) => {
      signals.push(signal);
    });

    const unmount = mount(
      () => {
        useOnMount(task);
      },
      { strict: true },
    );

    await Promise.resolve();
    expect(task).toHaveBeenCalledTimes(1);
    expect(signals[0]?.aborted).toBe(false);

    unmount();
    await Promise.resolve();
    expect(signals[0]?.aborted).toBe(true);
  });

  it('aborts the signal on unmount', async () => {
    let captured: AbortSignal | undefined;
    const unmount = mount(() => {
      useOnMount((signal) => {
        captured = signal;
      });
    });

    expect(captured?.aborted).toBe(false);
    unmount();
    await Promise.resolve();
    expect(captured?.aborted).toBe(true);
  });

  it('ignores a late result after unmount', async () => {
    let resolveTask!: (value: string) => void;
    const applied = vi.fn();

    const unmount = mount(() => {
      useOnMount(async (signal) => {
        const value = await new Promise<string>((resolve) => {
          resolveTask = resolve;
        });
        if (signal.aborted) return;
        applied(value);
      });
    });

    unmount();
    await Promise.resolve();
    resolveTask('late');
    await Promise.resolve();

    expect(applied).not.toHaveBeenCalled();
  });
});
