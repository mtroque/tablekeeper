import type { PatternCount } from './types';

/**
 * Parses `docs/CORRECTIONS.md` `## Log` rows and counts occurrences per pattern.
 * Patterns with `count >= 2` that have at least one non-promoted, non-dismissed row are
 * flagged as `/harden` candidates.
 */
export function countCorrections(markdown: string): PatternCount[] {
  const counts = new Map<string, { total: number; open: number }>();

  for (const line of markdown.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|')) continue;
    const cells = trimmed
      .slice(1, trimmed.endsWith('|') ? -1 : undefined)
      .split('|')
      .map((c) => c.trim());
    if (cells.length < 7) continue;
    const [date = '', rawPattern = '', , , , , status = ''] = cells;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const pattern = rawPattern.replaceAll('`', '').trim();
    if (!pattern) continue;

    const entry = counts.get(pattern) ?? { total: 0, open: 0 };
    entry.total += 1;
    const resolved = status.startsWith('promoted:') || status.startsWith('dismissed:');
    if (!resolved) entry.open += 1;
    counts.set(pattern, entry);
  }

  return [...counts.entries()]
    .map(([pattern, { total, open }]) => ({
      pattern,
      count: total,
      hardenCandidate: total >= 2 && open > 0,
    }))
    .sort((a, b) => b.count - a.count || a.pattern.localeCompare(b.pattern));
}
