import { z } from 'zod';

import type { KeyValue } from './local-store';

/**
 * The in-progress score flow, kept in sessionStorage so a refresh or the sign-in redirect
 * doesn't lose it (docs/ARCHITECTURE.md → Client state and storage).
 */
export const FlowStateSchema = z.object({
  source: z.enum(['manual', 'photo']),
  /** The board as the player has it now. */
  state: z.unknown(),
  stateVersion: z.int().min(0),
  /** What the photo reading produced, to tell corrections apart. */
  draft: z.object({ state: z.unknown(), confidence: z.record(z.string(), z.number()) }).nullable(),
  /** The photo as a downscaled data URL, while on the capture step. */
  photo: z.object({ src: z.string(), width: z.number(), height: z.number() }).nullable(),
  corners: z
    .array(z.object({ x: z.number(), y: z.number() }))
    .length(4)
    .nullable(),
  warnings: z.array(z.string()),
});
export type FlowState = z.infer<typeof FlowStateSchema>;

export const flowKey = (gameId: string) => `tk:v1:flow:${gameId}`;

/** A stored flow, or null when missing or corrupt. */
export function parseFlow(raw: string | null): FlowState | null {
  if (raw === null) return null;
  try {
    const parsed = FlowStateSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function readFlow(storage: KeyValue, gameId: string): FlowState | null {
  try {
    return parseFlow(storage.getItem(flowKey(gameId)));
  } catch {
    return null;
  }
}

/** False when storage is full or blocked; the flow still works until a refresh. */
export function writeFlow(storage: KeyValue, gameId: string, flow: FlowState): boolean {
  try {
    storage.setItem(flowKey(gameId), JSON.stringify(flow));
    return true;
  } catch {
    return false;
  }
}

export function clearFlow(storage: KeyValue, gameId: string): void {
  try {
    storage.removeItem(flowKey(gameId));
  } catch {
    // Nothing kept, nothing to clear.
  }
}
