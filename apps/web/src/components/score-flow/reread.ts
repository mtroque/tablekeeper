import type { GameId, Quad } from '@tablekeeper/core';

import { detectBoard } from '@/lib/cv-client';
import type { FlowState } from '@/lib/session-store/flow-state';

import { photoPixels } from './photo';

/**
 * Reads the flow's photo again at its corners with a game-specific hint (`EditorProps.reread`).
 * The new flow has the reading's state, draft and warnings; null when there is no photo or
 * corners, or the reading fails.
 */
export async function rereadFlow(
  gameId: GameId,
  flow: FlowState,
  hints: Record<string, string>,
  deps = { pixels: photoPixels, detect: detectBoard },
): Promise<FlowState | null> {
  if (!flow.photo || !flow.corners) return null;
  try {
    const pixels = await deps.pixels(flow.photo);
    const result = await deps.detect(gameId, pixels, flow.corners as Quad, { hints });
    if (!result.ok) return null;
    const draft = result.value;
    return {
      ...flow,
      state: draft.state,
      draft: { state: draft.state, confidence: draft.confidence },
      warnings: draft.warnings,
    };
  } catch {
    return null;
  }
}
