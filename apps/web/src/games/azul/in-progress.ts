import { z } from 'zod';

import type { KeyValue } from '@/lib/session-store/local-store';

/**
 * A guest's Azul games in progress on this device. The store's `list` is empty for guests
 * (they have no history), so the score home keeps the ids here; each is read back through
 * the store.
 */
const KEY = 'tk:v1:azul:in-progress';

const IdsSchema = z.array(z.string().max(100)).max(50);

export function readInProgress(storage: KeyValue): string[] {
  try {
    const raw = storage.getItem(KEY);
    if (raw === null) return [];
    const parsed = IdsSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

function write(storage: KeyValue, ids: string[]): void {
  try {
    if (ids.length === 0) storage.removeItem(KEY);
    else storage.setItem(KEY, JSON.stringify(ids.slice(0, 50)));
  } catch {
    // Without storage the game can still be resumed from its URL in this tab.
  }
}

/** Newest first. */
export function addInProgress(storage: KeyValue, id: string): void {
  write(storage, [id, ...readInProgress(storage).filter((other) => other !== id)]);
}

export function removeInProgress(storage: KeyValue, ids: readonly string[]): void {
  write(
    storage,
    readInProgress(storage).filter((id) => !ids.includes(id)),
  );
}

/** The round being entered, kept per game so a refresh doesn't lose the taps. */
const draftKey = (id: string) => `tk:v1:azul:draft:${id}`;

export const DraftSchema = z.object({
  /** How many rounds were confirmed when this draft started. */
  forRound: z.int().min(0),
  wall: z.array(z.boolean()).length(25),
  floorCount: z.int().min(0).max(7),
});
export type Draft = z.infer<typeof DraftSchema>;

export function readDraft(storage: KeyValue, id: string): Draft | null {
  try {
    const raw = storage.getItem(draftKey(id));
    if (raw === null) return null;
    const parsed = DraftSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function writeDraft(storage: KeyValue, id: string, draft: Draft | null): void {
  try {
    if (draft) storage.setItem(draftKey(id), JSON.stringify(draft));
    else storage.removeItem(draftKey(id));
  } catch {
    // The draft only lives in memory then.
  }
}
