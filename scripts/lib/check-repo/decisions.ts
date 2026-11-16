/**
 * Checks `docs/DECISIONS.md` ids: unique and increasing down the table. Gaps are fine (removed
 * entries). Two branches that each append the next id clash after the second one rebases; this
 * names the fix (AGENTS.md → Parallel sessions → Shared docs).
 */
export function checkDecisionIds(markdown: string, path = 'docs/DECISIONS.md'): string[] {
  const failures: string[] = [];
  const seen = new Set<number>();
  let previous = 0;
  for (const match of markdown.matchAll(/^\|\s*D-(\d+)\s*\|/gm)) {
    const id = Number(match[1]);
    const label = `D-${match[1] ?? ''}`;
    if (seen.has(id)) {
      failures.push(
        `${path}: ${label} is used twice. After rebasing, renumber your new entries after the last id on main (AGENTS.md → Parallel sessions → Shared docs).`,
      );
    } else if (id < previous) {
      failures.push(
        `${path}: ${label} comes after D-${String(previous).padStart(3, '0')}. Append new decisions at the end with the next id (AGENTS.md → Parallel sessions → Shared docs).`,
      );
    }
    seen.add(id);
    previous = Math.max(previous, id);
  }
  return failures;
}
