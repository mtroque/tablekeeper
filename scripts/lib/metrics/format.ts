import { traceColumns, type TraceWeek } from './grading';
import type { BaselineEntry, PatternCount, WeekMetrics } from './types';

function fmtPct(value: number | null): string {
  return value === null ? '-' : `${(value * 100).toFixed(0)}%`;
}

function fmtNum(value: number | null, digits = 0): string {
  return value === null ? '-' : value.toFixed(digits);
}

export function formatMetricsReport(opts: {
  weeks: readonly WeekMetrics[];
  baselineEntries: readonly BaselineEntry[];
  corrections: readonly PatternCount[];
  /** Session grading counts per ISO week, read from "Grading report <week>" issues (W16). */
  traces?: ReadonlyMap<string, TraceWeek>;
}): string {
  const totalBaseline = opts.baselineEntries.reduce((sum, e) => sum + e.count, 0);
  const hardenList = opts.corrections.filter((c) => c.hardenCandidate);

  const lines = [
    '# Factory metrics',
    '',
    '| Week | Merged (factory) | Reverts | Revert rate | CI 1st pass | Factory runs | Finished | Needs human | Review rounds | Failed calls/session | Top failures |',
    '|---|---|---|---|---|---|---|---|---|---|---|',
    ...opts.weeks.map((w) => {
      const trace = traceColumns(opts.traces?.get(w.week));
      return `| ${w.week} | ${w.merged} (${w.factoryMerged}) | ${w.reverts} | ${fmtPct(w.revertRate)} | ${fmtPct(w.ciFirstPassRate)} | ${fmtNum(w.factoryRuns)} | ${fmtNum(w.factoryFinished)} | ${fmtPct(w.needsHumanRate)} | ${fmtNum(w.avgReviewRounds, 1)} | ${trace.perSession} | ${trace.top} |`;
    }),
    '',
    `- **Lint baseline entries:** ${opts.baselineEntries.length} (${totalBaseline} total violations)`,
    `- **/harden candidates (count >= 2, open):** ${
      hardenList.length > 0 ? hardenList.map((c) => `${c.pattern} (${c.count})`).join(', ') : 'none'
    }`,
    '',
    '## Corrections by pattern',
    '',
    '| Pattern | Count | Needs /harden |',
    '|---|---|---|',
    ...opts.corrections.map(
      (c) => `| \`${c.pattern}\` | ${c.count} | ${c.hardenCandidate ? 'yes' : 'no'} |`,
    ),
    '',
  ];

  return lines.join('\n');
}
