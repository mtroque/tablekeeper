/**
 * Confidence key a photo draft gives a space whose height it couldn't see (the detector's
 * `heightKey`, kept here so the editor doesn't load the detector).
 */
export const heightKey = (key: string) => `${key}:height`;

const HEIGHT_SUFFIX = heightKey('');

/**
 * One confidence per space for the board's outline: the lower of its color (`"q,r"`) and height
 * (`"q,r:height"`) keys, so a space waiting for its height is highlighted like an uncertain color.
 */
export function spaceConfidence(
  confidence: Record<string, number> | undefined,
): Record<string, number> | undefined {
  if (!confidence) return undefined;
  const bySpace: Record<string, number> = {};
  for (const [key, value] of Object.entries(confidence)) {
    const space = key.endsWith(HEIGHT_SUFFIX) ? key.slice(0, -HEIGHT_SUFFIX.length) : key;
    bySpace[space] = Math.min(bySpace[space] ?? value, value);
  }
  return bySpace;
}

/**
 * The draft's confidence once the player has picked a stack for a space: its color and height
 * keys, where the photo gave them, become 1, so the space leaves the highlight and the banner.
 * No key is added or removed, so `detection_meta`'s `detected` stays the reading's count.
 */
export function answerSpace(
  confidence: Record<string, number>,
  key: string,
): Record<string, number> {
  const next = { ...confidence };
  for (const answered of [key, heightKey(key)]) if (answered in next) next[answered] = 1;
  return next;
}
