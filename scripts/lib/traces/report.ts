import { CLASSES, FAILURE_CLASSES, taggedFindings } from './classify';
import type { FailureClass, GradedSession, JudgedSession, TraceClass } from './types';

export type ProposedRow = {
  tag: string;
  cls: TraceClass;
  sessions: number;
  occurrences: number;
  where: string;
  newTag: boolean;
};

export type GradeMetrics = {
  week: string;
  sessions: number;
  toolCalls: number;
  failed: number;
  byClass: Partial<Record<FailureClass, number>>;
};

const WHERE_LIMIT = 4;

export function shortId(id: string): string {
  return id.slice(0, 8);
}

function sessionLabel(g: GradedSession): string {
  return `${shortId(g.session.id)}${g.pr === null ? '' : ` (#${g.pr})`}`;
}

/** One proposed `trace` row per tagged class: counts, sessions and PRs, fixed paraphrase and fix. */
export function proposedRows(
  sessions: readonly GradedSession[],
  knownTags: ReadonlySet<string>,
): ProposedRow[] {
  const byClass = new Map<TraceClass, { sessions: GradedSession[]; occurrences: number }>();
  for (const g of sessions) {
    const counts = new Map<TraceClass, number>();
    for (const f of taggedFindings(g)) counts.set(f.cls, (counts.get(f.cls) ?? 0) + 1);
    for (const [cls, n] of counts) {
      const entry = byClass.get(cls) ?? { sessions: [], occurrences: 0 };
      entry.sessions.push(g);
      entry.occurrences += n;
      byClass.set(cls, entry);
    }
  }
  return [...byClass.entries()]
    .map(([cls, { sessions: list, occurrences }]) => {
      const tag = CLASSES[cls].tag ?? cls;
      const shown = list.slice(0, WHERE_LIMIT).map(sessionLabel).join(', ');
      const more = list.length > WHERE_LIMIT ? ` and ${list.length - WHERE_LIMIT} more` : '';
      return {
        tag,
        cls,
        sessions: list.length,
        occurrences,
        where: `${list.length} session${list.length === 1 ? '' : 's'}, ${occurrences} call${occurrences === 1 ? '' : 's'}: ${shown}${more}`,
        newTag: !knownTags.has(tag),
      };
    })
    .sort((a, b) => b.occurrences - a.occurrences || a.tag.localeCompare(b.tag));
}

/** Pattern tags already used in `docs/CORRECTIONS.md`. */
export function knownTagsFrom(markdown: string): Set<string> {
  const tags = new Set<string>();
  for (const m of markdown.matchAll(/^\|\s*\d{4}-\d{2}-\d{2}\s*\|\s*`([a-z0-9-]+)`/gm)) {
    if (m[1]) tags.add(m[1]);
  }
  return tags;
}

export function gradeMetrics(week: string, sessions: readonly GradedSession[]): GradeMetrics {
  const byClass: Partial<Record<FailureClass, number>> = {};
  let toolCalls = 0;
  let failed = 0;
  for (const g of sessions) {
    toolCalls += g.metrics.toolCalls;
    failed += g.metrics.failed;
    for (const cls of FAILURE_CLASSES) {
      const n = g.metrics.failuresByClass[cls] ?? 0;
      if (n > 0) byClass[cls] = (byClass[cls] ?? 0) + n;
    }
  }
  return { week, sessions: sessions.length, toolCalls, failed, byClass };
}

/** Hidden block `pnpm metrics` reads back from the report issue (`scripts/lib/metrics/grading.ts`). */
export function gradeMetricsComment(metrics: GradeMetrics): string {
  return `<!-- grade-metrics ${JSON.stringify(metrics)} -->`;
}

function fmtRate(n: number, d: number): string {
  return d === 0 ? '-' : (n / d).toFixed(1);
}

/**
 * The grading report: counts, failures by class, proposed `trace` rows, per-session metrics and
 * the judged sample. Holds counts, tags, session ids and fixed paraphrases only, never transcript text.
 */
export function formatReport(opts: {
  week: string;
  /** Defaults to `Grading report <week>`. */
  title?: string;
  since: string;
  until: string;
  source: string;
  sessions: readonly GradedSession[];
  judged: readonly JudgedSession[];
  judgeTokens: number;
  knownTags: ReadonlySet<string>;
  date: string;
}): string {
  const { sessions } = opts;
  const metrics = gradeMetrics(opts.week, sessions);
  const runners = new Map<string, number>();
  for (const g of sessions) runners.set(g.session.runner, (runners.get(g.session.runner) ?? 0) + 1);
  const runnerText = [...runners.entries()].map(([r, n]) => `${r} ${n}`).join(', ') || 'none';
  const rows = proposedRows(sessions, opts.knownTags);
  const sessionsByClass = new Map<FailureClass, number>();
  for (const g of sessions) {
    for (const cls of FAILURE_CLASSES) {
      if ((g.metrics.failuresByClass[cls] ?? 0) > 0) {
        sessionsByClass.set(cls, (sessionsByClass.get(cls) ?? 0) + 1);
      }
    }
  }

  const lines = [
    `# ${opts.title ?? `Grading report ${opts.week}`}`,
    '',
    `Sessions from ${opts.since} to ${opts.until} (${opts.source}): ${sessions.length} (${runnerText}). Tool calls: ${metrics.toolCalls}. Failed: ${metrics.failed} (${fmtRate(metrics.failed, sessions.length)} per session).`,
    '',
    '## Failures by class',
    '',
    '| Class | Tag | Failed calls | Sessions |',
    '|---|---|---|---|',
    ...FAILURE_CLASSES.filter((cls) => (metrics.byClass[cls] ?? 0) > 0).map(
      (cls) =>
        `| ${cls} | ${CLASSES[cls].tag === null ? '-' : `\`${CLASSES[cls].tag}\``} | ${metrics.byClass[cls] ?? 0} | ${sessionsByClass.get(cls) ?? 0} |`,
    ),
    '',
    '## Proposed trace rows',
    '',
    rows.length === 0
      ? 'None.'
      : 'Rows for `docs/CORRECTIONS.md` → Log. Add `agent-ready` to have the factory append them, or close this issue. Tags marked (new) are not in the log yet.',
    '',
    ...(rows.length === 0
      ? []
      : [
          '| Date | Pattern | Where | What was wrong | Correction | Source | Status |',
          '|---|---|---|---|---|---|---|',
          ...rows.map(
            (r) =>
              `| ${opts.date} | \`${r.tag}\`${r.newTag ? ' (new)' : ''} | ${r.where} | ${CLASSES[r.cls].wrong} | ${CLASSES[r.cls].fix} | trace | open |`,
          ),
          '',
        ]),
    '## Sessions',
    '',
    '| Session | Runner | Branch | PR | Calls | Failed | User turns | Interrupts |',
    '|---|---|---|---|---|---|---|---|',
    ...sessions.map(
      (g) =>
        `| ${shortId(g.session.id)} | ${g.session.runner} | ${g.session.branch ?? '-'} | ${g.pr === null ? '-' : `#${g.pr}`} | ${g.metrics.toolCalls} | ${g.metrics.failed} | ${g.metrics.userTurns} | ${g.metrics.interruptions} |`,
    ),
    '',
    '## Judged sample',
    '',
  ];

  if (opts.judged.length === 0) {
    lines.push('None.');
  } else {
    lines.push(
      `${opts.judged.length} session(s), ${opts.judgeTokens} tokens.`,
      '',
      '| Session | Why | Rubric | Label | Pass | Note |',
      '|---|---|---|---|---|---|',
    );
    for (const j of opts.judged) {
      if (j.results === null) {
        lines.push(`| ${shortId(j.id)} | ${j.reason} | - | no valid answer | - | - |`);
        continue;
      }
      for (const r of j.results) {
        lines.push(
          `| ${shortId(j.id)} | ${j.reason} | ${r.rubric} | ${r.label} | ${r.pass ? 'yes' : 'no'} | ${r.note} |`,
        );
      }
    }
  }
  lines.push('', gradeMetricsComment(metrics), '');
  return lines.join('\n');
}
