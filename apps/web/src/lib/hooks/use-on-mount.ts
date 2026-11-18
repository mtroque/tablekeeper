'use client';

import { useEffect, useRef } from 'react';

/**
 * Runs `task(signal)` once per mount (once in React Strict Mode too), aborts `signal` on unmount,
 * and lets `task` ignore results after `signal.aborted`.
 */
export function useOnMount(task: (signal: AbortSignal) => void | Promise<void>): void {
  const controllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    if (!controllerRef.current) {
      const controller = new AbortController();
      controllerRef.current = controller;
      void task(controller.signal);
    }
    return () => {
      mountedRef.current = false;
      const controller = controllerRef.current;
      // Defer abort by a microtask so Strict Mode's synchronous remount keeps the task alive.
      queueMicrotask(() => {
        if (!mountedRef.current && controllerRef.current === controller) {
          controller?.abort();
          controllerRef.current = null;
        }
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once on mount
  }, []);
}
