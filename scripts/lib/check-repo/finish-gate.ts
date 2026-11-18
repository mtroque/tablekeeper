/**
 * Finish gate (AGENTS.md → Definition of done, item 2): a slice can't be folded away, or marked ✅
 * on the roadmap, while an acceptance criterion is still unchecked. A criterion that can't be
 * verified yet is moved to a follow-up spec by ending its line with `(moved to <id>)`.
 */

const MOVED = /\(moved to ([A-Z][A-Z0-9]*\d+)\)\s*$/;

/** Unchecked `- [ ]` lines under `## Acceptance criteria`. */
export function uncheckedCriteria(markdown: string): string[] {
  const lines = markdown.split(/\r?\n/);
  const start = lines.findIndex((line) => /^##\s+Acceptance criteria\b/.test(line.trim()));
  if (start === -1) return [];
  const open: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (/^##\s+/.test(line.trim())) break;
    const match = /^\s*-\s+\[ \]\s+(.*)$/.exec(line);
    if (match?.[1]) open.push(match[1].trim());
  }
  return open;
}

/** Roadmap rows as `id → status`, from `| <id> | ... | <status> |` lines. */
export function roadmapStatuses(markdown: string): Map<string, string> {
  const statuses = new Map<string, string>();
  for (const line of markdown.split(/\r?\n/)) {
    const cells = line.split('|').map((cell) => cell.trim());
    const id = cells[1] ?? '';
    if (!/^[A-Z][A-Z0-9]*\d+$/.test(id)) continue;
    statuses.set(id, cells.at(-2) ?? '');
  }
  return statuses;
}

export type FinishGateInput = {
  /** Specs this branch deleted, path → content before deletion. */
  deletedSpecs: Record<string, string>;
  /** Specs that exist at HEAD, path → content. */
  currentSpecs: Record<string, string>;
  /** `docs/ROADMAP.md` at the branch base and at HEAD (undefined on `main` or without a base). */
  roadmapBase?: string | undefined;
  roadmapHead?: string | undefined;
};

const specId = (path: string): string => /docs\/slices\/([A-Z][A-Z0-9]*\d+)-/.exec(path)?.[1] ?? '';

export function checkFinishGate(input: FinishGateInput): string[] {
  const failures: string[] = [];
  const existing = new Set(Object.keys(input.currentSpecs).map(specId));

  for (const [path, content] of Object.entries(input.deletedSpecs)) {
    for (const criterion of uncheckedCriteria(content)) {
      const moved = MOVED.exec(criterion)?.[1];
      if (moved && existing.has(moved)) continue;
      const why = moved
        ? `it says moved to ${moved}, but docs/slices/${moved}-*.md doesn't exist`
        : 'it is unchecked';
      failures.push(
        `${path}: removed while a criterion is open (${why}): "${criterion}". Verify and check it, end the line with "(moved to <id>)" naming a follow-up spec that has it, or keep the slice open (AGENTS.md → Definition of done, item 2).`,
      );
    }
  }

  if (input.roadmapBase !== undefined && input.roadmapHead !== undefined) {
    const before = roadmapStatuses(input.roadmapBase);
    for (const [id, status] of roadmapStatuses(input.roadmapHead)) {
      if (status !== '✅' || before.get(id) === '✅') continue;
      const spec = Object.entries(input.currentSpecs).find(([path]) => specId(path) === id);
      if (!spec) continue;
      const open = uncheckedCriteria(spec[1]).filter((criterion) => !MOVED.test(criterion));
      if (open.length > 0) {
        failures.push(
          `docs/ROADMAP.md: ${id} is marked ✅ while ${spec[0]} has ${open.length} unchecked criteria, first: "${open[0] ?? ''}". Finish or move them first (AGENTS.md → Definition of done, item 2).`,
        );
      }
    }
  }

  return failures.sort();
}
