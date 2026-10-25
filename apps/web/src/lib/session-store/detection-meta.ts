import type { DetectionMeta } from '@tablekeeper/core';

/** Every leaf of a JSON value as `path → value`, paths joined with dots (`cells.4`). */
function leaves(value: unknown, path: string, out: Map<string, unknown>): Map<string, unknown> {
  if (Array.isArray(value)) {
    value.forEach((item, i) => leaves(item, path ? `${path}.${i}` : String(i), out));
  } else if (value !== null && typeof value === 'object') {
    for (const [key, item] of Object.entries(value))
      leaves(item, path ? `${path}.${key}` : key, out);
  } else {
    out.set(path, value);
  }
  return out;
}

/**
 * What the player changed in a photo draft. Shared code can't map a game's confidence keys
 * to its state, so corrections are the state paths that differ; `detected` counts the values
 * the reading gave a confidence for. Manual entry has no draft and no meta.
 */
export function detectionMeta(
  draft: { state: unknown; confidence: Record<string, number> } | null,
  confirmed: unknown,
): DetectionMeta | undefined {
  if (!draft) return undefined;
  const before = leaves(draft.state, '', new Map());
  const after = leaves(confirmed, '', new Map());
  const corrected = [...new Set([...before.keys(), ...after.keys()])].filter(
    (path) => before.get(path) !== after.get(path),
  );
  return { corrected, detected: Object.keys(draft.confidence).length };
}
