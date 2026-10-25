import { DetectionMetaSchema, isGameId } from '@tablekeeper/core';
import { z } from 'zod';

import type { KeyValue } from './local-store';
import type { SessionStore } from './session-store';

/** A guest's result waiting for sign-in; sessionStorage survives the OAuth redirect. */
const PENDING_KEY = 'tk:v1:pending-save';

const PendingSaveSchema = z.object({
  input: z.object({
    gameId: z.string(),
    status: z.enum(['in_progress', 'completed']),
    state: z.unknown(),
    stateVersion: z.int().min(0),
    detectionMeta: DetectionMetaSchema.exactOptional(),
  }),
});
export type PendingSave = z.infer<typeof PendingSaveSchema>;

export function setPendingSave(storage: KeyValue, pending: PendingSave): void {
  try {
    storage.setItem(PENDING_KEY, JSON.stringify(pending));
  } catch {
    // Without storage the result can't survive the redirect; the player saves again after.
  }
}

export function clearPendingSave(storage: KeyValue): void {
  try {
    storage.removeItem(PENDING_KEY);
  } catch {
    // Nothing to clear.
  }
}

function readPendingSave(storage: KeyValue): PendingSave | null {
  try {
    const raw = storage.getItem(PENDING_KEY);
    if (raw === null) return null;
    const parsed = PendingSaveSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/**
 * Saves a result kept through sign-in. Returns where to go next: the saved game, or back to
 * the result (still in the flow state) to retry if saving failed; null when nothing was pending.
 */
export async function resumePendingSaveWith(
  storage: KeyValue,
  store: SessionStore,
): Promise<string | null> {
  const pending = readPendingSave(storage);
  if (!pending) return null;
  const { gameId } = pending.input;
  if (!isGameId(gameId)) {
    clearPendingSave(storage);
    return null;
  }
  try {
    const session = await store.save({ ...pending.input, gameId });
    clearPendingSave(storage);
    return `/games/${gameId}/history/${session.id}`;
  } catch {
    return `/games/${gameId}/score/result`;
  }
}
