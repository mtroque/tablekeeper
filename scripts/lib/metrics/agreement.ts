// W19 shadow agreement: how often merge authority's shadow decision matched what the owner did.
import { parseDecisionHistory, type DecisionEntry } from '../../factory/merge-policy';

import { isoWeek } from './reverts';

export type ShadowPr = {
  number: number;
  state: 'OPEN' | 'MERGED' | 'CLOSED';
  /** Head commit when the PR was merged or closed. */
  headSha: string;
  /** When it was merged or closed; null while open. */
  closedAt: string | null;
  /** Bodies of the PR's comments; the decision comment holds the history. */
  comments: readonly string[];
};

export type ShadowOutcome = 'merged' | 'changed' | 'closed';

export type ShadowResult = {
  number: number;
  week: string;
  decision: DecisionEntry['decision'];
  outcome: ShadowOutcome;
  groups: string[];
  agrees: boolean;
};

/**
 * The first shadow `merge` or `escalate` compared with what happened: merged at that same commit
 * (`merged`), merged after more commits (`changed`), or closed unmerged (`closed`). `merge`
 * agrees with `merged`; `escalate` agrees with `changed` or `closed`. Null while the PR is open
 * or without a shadow decision.
 */
export function shadowResult(pr: ShadowPr): ShadowResult | null {
  if (pr.state === 'OPEN' || !pr.closedAt) return null;
  const history = pr.comments.flatMap(parseDecisionHistory);
  const first = history.find((entry) => entry.mode === 'shadow');
  if (!first) return null;
  const outcome: ShadowOutcome =
    pr.state === 'CLOSED' ? 'closed' : pr.headSha === first.sha ? 'merged' : 'changed';
  return {
    number: pr.number,
    week: isoWeek(pr.closedAt),
    decision: first.decision,
    outcome,
    groups: first.groups,
    agrees: first.decision === 'merge' ? outcome === 'merged' : outcome !== 'merged',
  };
}

export type AgreementRow = { key: string; decided: number; agreed: number };

function tally(
  results: readonly ShadowResult[],
  keysOf: (r: ShadowResult) => string[],
): AgreementRow[] {
  const rows = new Map<string, AgreementRow>();
  for (const result of results) {
    for (const key of keysOf(result)) {
      const row = rows.get(key) ?? { key, decided: 0, agreed: 0 };
      row.decided += 1;
      if (result.agrees) row.agreed += 1;
      rows.set(key, row);
    }
  }
  return [...rows.values()].sort((a, b) => a.key.localeCompare(b.key));
}

function pct(row: AgreementRow | undefined): string {
  if (!row || row.decided === 0) return '-';
  return `${String(row.agreed)}/${String(row.decided)} (${((row.agreed / row.decided) * 100).toFixed(0)}%)`;
}

/** The report section: agreement per week (newest first, as in the weekly table) and per group. */
export function formatShadowAgreement(weeks: readonly string[], prs: readonly ShadowPr[]): string {
  const results = prs.map(shadowResult).filter((r): r is ShadowResult => r !== null);
  const byWeek = new Map(tally(results, (r) => [r.week]).map((row) => [row.key, row]));
  const byGroup = tally(results, (r) => r.groups);
  const total = tally(results, () => ['all'])[0];
  const lines = [
    '## Merge authority (W19 shadow agreement)',
    '',
    `Shadow decisions compared with the owner's call (merged as is, changed, or closed): ${pct(total)} agree overall.`,
    '',
    '| Week | Agreement |',
    '|---|---|',
    ...weeks.map((week) => `| ${week} | ${pct(byWeek.get(week))} |`),
    '',
    '| Group | Agreement |',
    '|---|---|',
    ...(byGroup.length > 0
      ? byGroup.map((row) => `| \`${row.key}\` | ${pct(row)} |`)
      : ['| - | - |']),
    '',
  ];
  return lines.join('\n');
}
