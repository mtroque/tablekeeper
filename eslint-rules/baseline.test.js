import { describe, expect, it } from 'vitest';

import { evaluateBaseline } from './baseline.js';

const ROOT = '/repo';

function result(file, messages) {
  return {
    filePath: `${ROOT}/${file}`,
    messages: messages.map(([ruleId, message, line = 1]) => ({
      ruleId,
      severity: 2,
      message,
      line,
      column: 1,
    })),
  };
}

describe('evaluateBaseline', () => {
  it('passes when errors match the recorded baseline counts', () => {
    const results = [result('src/a.ts', [['rules/no-raw-colors', 'raw color']])];
    const baseline = { 'rules/no-raw-colors': { 'src/a.ts': 1 } };
    expect(evaluateBaseline(results, baseline, ROOT)).toEqual({
      errors: [],
      warnings: [],
      reminders: [],
    });
  });

  it('fails on an unbaselined file or rule', () => {
    const results = [result('src/b.ts', [['rules/no-raw-colors', 'raw color']])];
    const baseline = { 'rules/no-raw-colors': { 'src/a.ts': 1 } };
    const out = evaluateBaseline(results, baseline, ROOT);
    expect(out.errors).toHaveLength(1);
    expect(out.errors[0]?.file).toBe('src/b.ts');
  });

  it('fails when a baselined file exceeds its recorded count', () => {
    const results = [
      result('src/a.ts', [
        ['rules/no-raw-colors', 'first', 1],
        ['rules/no-raw-colors', 'second', 2],
      ]),
    ];
    const baseline = { 'rules/no-raw-colors': { 'src/a.ts': 1 } };
    const out = evaluateBaseline(results, baseline, ROOT);
    expect(out.errors).toHaveLength(2);
  });

  it('prints a reminder when a baselined file has fewer violations than recorded', () => {
    const results = [result('src/a.ts', [])];
    const baseline = { 'rules/no-raw-colors': { 'src/a.ts': 2 } };
    const out = evaluateBaseline(results, baseline, ROOT);
    expect(out.errors).toEqual([]);
    expect(out.reminders).toEqual([
      'Baseline can shrink: rules/no-raw-colors in src/a.ts (0 actual < 2 recorded in eslint-rules/baseline.json).',
    ]);
  });
});
