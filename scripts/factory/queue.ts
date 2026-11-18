export type QueueIssue = {
  number: number;
  title: string;
  body: string;
  labels: readonly string[];
  hasOpenPr: boolean;
  /** Open issue numbers that block this issue. */
  blockedBy?: readonly number[];
  /** Slice id if this issue builds a slice, e.g. `W14` or `P4`. */
  sliceId?: string | null;
};

export type RoadmapStatus = '✅' | '🟨' | '⬜' | '⏸';

export function parseRoadmapStatuses(
  markdown: string,
): Map<string, { status: RoadmapStatus; deps: string[] }> {
  const map = new Map<string, { status: RoadmapStatus; deps: string[] }>();
  for (const line of markdown.split(/\r?\n/)) {
    const match = /^\|\s*([A-Z]\d+)\s*\|\s*[^|]+\|\s*([^|]+)\|\s*([✅🟨⬜⏸])\s*\|/.exec(
      line.trim(),
    );
    if (!match) continue;
    const [, id = '', rawDeps = '', status = '⬜'] = match;
    const deps =
      rawDeps.trim() === '-'
        ? []
        : rawDeps
            .split(',')
            .map((d) => d.trim())
            .filter((d) => /^[A-Z]\d+$/.test(d));
    map.set(id, { status: status as RoadmapStatus, deps });
  }
  return map;
}

export function extractSliceId(
  issue: Pick<QueueIssue, 'title' | 'body' | 'sliceId'>,
): string | null {
  if (issue.sliceId !== undefined) return issue.sliceId;
  const specMatch = /docs\/slices\/([A-Z]\d+)-/.exec(issue.body);
  if (specMatch?.[1]) return specMatch[1];
  const titleMatch = /^([A-Z]\d+)\b/.exec(issue.title.trim());
  return titleMatch?.[1] ?? null;
}

export function isIssueEligible(
  issue: QueueIssue,
  roadmap: ReadonlyMap<string, { status: RoadmapStatus; deps: string[] }>,
  openIssueNumbers: ReadonlySet<number>,
): boolean {
  if (!issue.labels.includes('agent-ready')) return false;
  if (issue.labels.includes('needs-human')) return false;
  if (issue.labels.includes('in-progress')) return false;
  if (issue.hasOpenPr) return false;

  for (const blocker of issue.blockedBy ?? []) {
    if (openIssueNumbers.has(blocker)) return false;
  }

  const sliceId = extractSliceId(issue);
  if (sliceId) {
    const entry = roadmap.get(sliceId);
    if (entry) {
      if (entry.status === '✅' || entry.status === '⏸') return false;
      for (const dep of entry.deps) {
        if (roadmap.get(dep)?.status !== '✅') return false;
      }
    }
  }

  return true;
}

/**
 * Pure queue picker: selects the first eligible `agent-ready` issue in Project order.
 */
export function pickNextIssue(
  issues: readonly QueueIssue[],
  projectOrder: readonly number[],
  roadmapMarkdown: string,
): QueueIssue | null {
  const roadmap = parseRoadmapStatuses(roadmapMarkdown);
  const openNumbers = new Set(issues.map((i) => i.number));
  const byNumber = new Map(issues.map((i) => [i.number, i]));

  const ordered: QueueIssue[] = [];
  const seen = new Set<number>();
  for (const num of projectOrder) {
    const issue = byNumber.get(num);
    if (issue) {
      ordered.push(issue);
      seen.add(num);
    }
  }
  for (const issue of issues) {
    if (!seen.has(issue.number)) ordered.push(issue);
  }

  return ordered.find((issue) => isIssueEligible(issue, roadmap, openNumbers)) ?? null;
}
