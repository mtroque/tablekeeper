import { taggedFindings } from './classify';
import type { GradedSession } from './types';

export type Selection = { id: string; reason: 'flagged' | 'sample' };

function hashString(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Deterministic per-session draw in [0, 1), so a rerun of the same week judges the same sample. */
function draw(seed: string, id: string): number {
  return hashString(`${seed}:${id}`) / 2 ** 32;
}

/**
 * Picks the sessions a model judges: those with unclassified failures, user rejections or
 * interruptions, the `flagTop` with the most tagged findings, then a `sampleRate` share of the rest.
 * Flagged sessions come first; the list is capped at `maxJudged`.
 */
export function selectForJudging(
  sessions: readonly GradedSession[],
  opts: { sampleRate: number; flagTop: number; maxJudged: number; seed: string },
): Selection[] {
  const flagged = new Set<string>();
  for (const g of sessions) {
    const m = g.metrics;
    if ((m.failuresByClass.unclassified ?? 0) > 0) flagged.add(g.session.id);
    if ((m.failuresByClass['user-rejected'] ?? 0) > 0 || m.interruptions > 0)
      flagged.add(g.session.id);
  }
  const byFindings = sessions
    .map((g) => ({ id: g.session.id, n: taggedFindings(g).length }))
    .filter((s) => s.n > 0)
    .sort((a, b) => b.n - a.n || a.id.localeCompare(b.id));
  for (const s of byFindings.slice(0, opts.flagTop)) flagged.add(s.id);

  const picked: Selection[] = sessions
    .filter((g) => flagged.has(g.session.id))
    .sort((a, b) => b.metrics.failed - a.metrics.failed || a.session.id.localeCompare(b.session.id))
    .map((g) => ({ id: g.session.id, reason: 'flagged' as const }));
  for (const g of sessions) {
    if (flagged.has(g.session.id)) continue;
    if (draw(opts.seed, g.session.id) < opts.sampleRate)
      picked.push({ id: g.session.id, reason: 'sample' });
  }
  return picked.slice(0, opts.maxJudged);
}
