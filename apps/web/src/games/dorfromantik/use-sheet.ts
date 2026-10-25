'use client';

import { DorfromantikStateSchema } from '@tablekeeper/core';
import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { z } from 'zod';

/**
 * The scoresheet in progress and the last finished game, kept in sessionStorage so a refresh
 * keeps them (docs/ARCHITECTURE.md → Client state and storage).
 */
const KEY = 'tk:v1:flow:dorfromantik';

export const FinishedGameSchema = z.object({
  sessionId: z.uuid(),
  gameNumber: z.int().min(1),
  total: z.int().min(0),
  /** True once the campaign has recorded the game; false when only the session was saved. */
  recorded: z.boolean(),
  /** The unlocks reported for this game have been saved. */
  unlocksDone: z.boolean(),
});
export type FinishedGame = z.infer<typeof FinishedGameSchema>;

const SheetFlowSchema = z.object({
  sheet: DorfromantikStateSchema.nullable(),
  finished: FinishedGameSchema.nullable(),
});
export type SheetFlow = z.infer<typeof SheetFlowSchema>;

const EMPTY: SheetFlow = { sheet: null, finished: null };

const listeners = new Set<() => void>();
// Kept here when sessionStorage refuses (full or blocked), until the page closes.
let fallback: string | null | undefined;

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function readRaw(): string | null {
  if (fallback !== undefined) return fallback;
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function parse(raw: string | null): SheetFlow {
  if (raw === null) return EMPTY;
  try {
    const parsed = SheetFlowSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : EMPTY;
  } catch {
    return EMPTY;
  }
}

function writeRaw(raw: string): void {
  try {
    sessionStorage.setItem(KEY, raw);
    fallback = undefined;
  } catch {
    fallback = raw;
  }
  for (const listener of listeners) listener();
}

/** Null while the server renders; the browser reads sessionStorage. */
export function useSheetFlow() {
  const raw = useSyncExternalStore(subscribe, readRaw, () => undefined);
  const flow = useMemo(() => (raw === undefined ? null : parse(raw)), [raw]);
  const update = useCallback((patch: Partial<SheetFlow>) => {
    writeRaw(JSON.stringify({ ...parse(readRaw()), ...patch }));
  }, []);
  return { flow, update };
}
