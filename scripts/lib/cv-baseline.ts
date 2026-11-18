import { z } from 'zod';

export const CELL_ACCURACY_DROP_TOLERANCE = 0.005;
export const BOARD_FOUND_DROP_TOLERANCE = 0.005;
export const CORNER_ERROR_RISE_TOLERANCE = 0.1;
const EPSILON = 1e-9;

export const CvBaselineSchema = z.object({
  cellAccuracy: z.number().min(0).max(1),
  boardFoundRate: z.number().min(0).max(1),
  flaggedErrorRate: z.number().min(0).max(1).nullable(),
  meanCornerError: z.number().min(0).nullable(),
  recordedAt: z.string(),
  commit: z.string().min(1),
});
export type CvBaseline = z.infer<typeof CvBaselineSchema>;

export type CvMetrics = Pick<
  CvBaseline,
  'cellAccuracy' | 'boardFoundRate' | 'flaggedErrorRate' | 'meanCornerError'
>;

export type BaselineFailure = {
  metric: 'cellAccuracy' | 'boardFoundRate' | 'meanCornerError';
  baseline: number;
  current: number;
  reason: string;
};

export type BaselineComparison = {
  passed: boolean;
  failures: BaselineFailure[];
};

/**
 * Compares current CV metrics against a recorded baseline.
 * Fails if cell accuracy or board-found rate drops > 0.5pp, or mean corner error rises > 10%.
 */
export function compareCvBaseline(baseline: CvBaseline, current: CvMetrics): BaselineComparison {
  const failures: BaselineFailure[] = [];

  if (baseline.cellAccuracy - current.cellAccuracy > CELL_ACCURACY_DROP_TOLERANCE + EPSILON) {
    failures.push({
      metric: 'cellAccuracy',
      baseline: baseline.cellAccuracy,
      current: current.cellAccuracy,
      reason: `Cell accuracy dropped by ${((baseline.cellAccuracy - current.cellAccuracy) * 100).toFixed(2)}pp (max 0.50pp).`,
    });
  }

  if (baseline.boardFoundRate - current.boardFoundRate > BOARD_FOUND_DROP_TOLERANCE + EPSILON) {
    failures.push({
      metric: 'boardFoundRate',
      baseline: baseline.boardFoundRate,
      current: current.boardFoundRate,
      reason: `Board-found rate dropped by ${((baseline.boardFoundRate - current.boardFoundRate) * 100).toFixed(2)}pp (max 0.50pp).`,
    });
  }

  if (baseline.meanCornerError !== null && current.meanCornerError !== null) {
    const allowed =
      baseline.meanCornerError === 0
        ? EPSILON
        : baseline.meanCornerError * (1 + CORNER_ERROR_RISE_TOLERANCE) + EPSILON;
    if (current.meanCornerError > allowed) {
      failures.push({
        metric: 'meanCornerError',
        baseline: baseline.meanCornerError,
        current: current.meanCornerError,
        reason: `Mean corner error rose from ${(baseline.meanCornerError * 100).toFixed(2)}% to ${(current.meanCornerError * 100).toFixed(2)}% (max +10%).`,
      });
    }
  }

  return { passed: failures.length === 0, failures };
}

/**
 * Returns which detector games have baselines and which are missing one.
 * Extra games without a detector are ignored.
 */
export function partitionBaselineGames(
  detectorGames: readonly string[],
  gamesWithBaseline: readonly string[],
): { ready: string[]; missingBaseline: string[] } {
  const baselineSet = new Set(gamesWithBaseline);
  const ready: string[] = [];
  const missingBaseline: string[] = [];
  for (const gameId of detectorGames) {
    if (baselineSet.has(gameId)) ready.push(gameId);
    else missingBaseline.push(gameId);
  }
  return { ready, missingBaseline };
}

function fmtPct(value: number | null): string {
  return value === null ? 'n/a' : `${(value * 100).toFixed(1)}%`;
}

function fmtDeltaPct(baseline: number | null, current: number | null): string {
  if (baseline === null || current === null) return 'n/a';
  const diff = (current - baseline) * 100;
  const sign = diff > 0 ? '+' : '';
  return `${sign}${diff.toFixed(2)}pp`;
}

export function formatBaselineTable(
  gameId: string,
  baseline: CvBaseline,
  current: CvMetrics,
): string {
  const rows = [
    `## ${gameId}`,
    '',
    '| Metric | Baseline | Now | Change |',
    '|---|---|---|---|',
    `| Cell accuracy | ${fmtPct(baseline.cellAccuracy)} | ${fmtPct(current.cellAccuracy)} | ${fmtDeltaPct(baseline.cellAccuracy, current.cellAccuracy)} |`,
    `| Board found | ${fmtPct(baseline.boardFoundRate)} | ${fmtPct(current.boardFoundRate)} | ${fmtDeltaPct(baseline.boardFoundRate, current.boardFoundRate)} |`,
    `| Flagged errors | ${fmtPct(baseline.flaggedErrorRate)} | ${fmtPct(current.flaggedErrorRate)} | ${fmtDeltaPct(baseline.flaggedErrorRate, current.flaggedErrorRate)} |`,
    `| Mean corner error | ${fmtPct(baseline.meanCornerError)} | ${fmtPct(current.meanCornerError)} | ${fmtDeltaPct(baseline.meanCornerError, current.meanCornerError)} |`,
  ];
  return rows.join('\n');
}
