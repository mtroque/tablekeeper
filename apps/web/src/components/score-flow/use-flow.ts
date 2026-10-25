'use client';

import { getGame, parseState, type GameDefinition, type ScoreBreakdown } from '@tablekeeper/core';
import { useCallback, useMemo, useSyncExternalStore } from 'react';

import { flowKey, parseFlow, type FlowState } from '@/lib/session-store/flow-state';

/** Reading sessionStorage waits for the browser, so the server render is `loading`. */
export type FlowStatus = 'loading' | 'ready';

const listeners = new Set<() => void>();
// Flows that sessionStorage refused (full or blocked) live here until the page closes.
const fallback = new Map<string, string | null>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function readRaw(key: string): string | null {
  if (fallback.has(key)) return fallback.get(key) ?? null;
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeRaw(key: string, raw: string | null, notify = true): void {
  try {
    if (raw === null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, raw);
    fallback.delete(key);
  } catch {
    fallback.set(key, raw);
  }
  if (notify) for (const listener of listeners) listener();
}

/** The score flow's state for a game, persisted to sessionStorage on every change. */
export function useFlow(gameId: string) {
  const key = flowKey(gameId);
  const raw = useSyncExternalStore(
    subscribe,
    () => readRaw(key),
    () => undefined,
  );
  const flow = useMemo(() => (raw === undefined ? null : parseFlow(raw)), [raw]);
  const status: FlowStatus = raw === undefined ? 'loading' : 'ready';

  const setFlow = useCallback(
    (next: FlowState) => {
      writeRaw(key, JSON.stringify(next));
    },
    [key],
  );

  const reset = useCallback(() => {
    writeRaw(key, null);
  }, [key]);

  /**
   * Clears the stored flow without re-rendering, for when the page is navigating away (after
   * a save); a re-render here would treat the board as lost and send the player home.
   */
  const discard = useCallback(() => {
    writeRaw(key, null, false);
  }, [key]);

  return { status, flow, setFlow, reset, discard };
}

export function requireGame(gameId: string): GameDefinition {
  const game = getGame(gameId);
  if (!game) throw new Error(`Unknown game ${gameId}`);
  return game;
}

/** The board's score, or null while the state isn't valid. */
export function scoreOf(game: GameDefinition, flow: FlowState): ScoreBreakdown | null {
  if (!game.score) return null;
  const parsed = parseState(game, flow.state, flow.stateVersion);
  return parsed.ok ? game.score(parsed.value) : null;
}

export function manualFlow(game: GameDefinition): FlowState {
  return {
    source: 'manual',
    state: game.initialState(),
    stateVersion: game.stateVersion,
    draft: null,
    photo: null,
    corners: null,
    warnings: [],
  };
}
