import { describe, expect, it } from 'vitest';

import {
  compareCvBaseline,
  formatBaselineTable,
  partitionBaselineGames,
  type CvBaseline,
} from './cv-baseline';

const BASELINE: CvBaseline = {
  cellAccuracy: 0.9,
  boardFoundRate: 0.8,
  flaggedErrorRate: 0.5,
  meanCornerError: 0.02,
  recordedAt: '2026-11-18T00:00:00.000Z',
  commit: 'abc1234',
};

describe('compareCvBaseline', () => {
  it('passes when metrics match or improve on the baseline', () => {
    expect(compareCvBaseline(BASELINE, BASELINE).passed).toBe(true);
    expect(
      compareCvBaseline(BASELINE, {
        cellAccuracy: 0.95,
        boardFoundRate: 1.0,
        flaggedErrorRate: 0.7,
        meanCornerError: 0.015,
      }).passed,
    ).toBe(true);
  });

  it('allows cellAccuracy at the 0.5pp tolerance and fails below it', () => {
    expect(compareCvBaseline(BASELINE, { ...BASELINE, cellAccuracy: 0.895 }).passed).toBe(true);
    const below = compareCvBaseline(BASELINE, { ...BASELINE, cellAccuracy: 0.8949 });
    expect(below.passed).toBe(false);
    expect(below.failures.map((f) => f.metric)).toEqual(['cellAccuracy']);
  });

  it('allows boardFoundRate at the 0.5pp tolerance and fails below it', () => {
    expect(compareCvBaseline(BASELINE, { ...BASELINE, boardFoundRate: 0.795 }).passed).toBe(true);
    const below = compareCvBaseline(BASELINE, { ...BASELINE, boardFoundRate: 0.7949 });
    expect(below.passed).toBe(false);
    expect(below.failures.map((f) => f.metric)).toEqual(['boardFoundRate']);
  });

  it('allows meanCornerError at +10% and fails above it', () => {
    expect(compareCvBaseline(BASELINE, { ...BASELINE, meanCornerError: 0.022 }).passed).toBe(true);
    const above = compareCvBaseline(BASELINE, { ...BASELINE, meanCornerError: 0.0221 });
    expect(above.passed).toBe(false);
    expect(above.failures.map((f) => f.metric)).toEqual(['meanCornerError']);
  });
});

describe('partitionBaselineGames', () => {
  it('flags detector games missing a baseline and ignores extra baselines without a detector', () => {
    const result = partitionBaselineGames(
      ['_example', 'harmonies', 'patchwork'],
      ['_example', 'patchwork', 'azul'],
    );
    expect(result.ready).toEqual(['_example', 'patchwork']);
    expect(result.missingBaseline).toEqual(['harmonies']);
  });
});

describe('formatBaselineTable', () => {
  it('formats baseline, now and change columns', () => {
    const table = formatBaselineTable('_example', BASELINE, {
      ...BASELINE,
      cellAccuracy: 0.91,
    });
    expect(table).toContain('## _example');
    expect(table).toContain('90.0%');
    expect(table).toContain('91.0%');
    expect(table).toContain('+1.00pp');
  });
});
