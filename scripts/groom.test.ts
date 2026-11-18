import { describe, expect, it } from 'vitest';

import { groomIssueTitle, planGroomIssues } from './groom';
import type { BaselineEntry } from './lib/metrics/types';

const ENTRIES: BaselineEntry[] = [
  { ruleId: 'rules/no-raw-colors', file: 'apps/web/src/a.tsx', count: 2 },
  { ruleId: 'rules/no-raw-colors', file: 'apps/web/src/b.tsx', count: 1 },
  { ruleId: 'rules/no-env-outside-config', file: 'apps/api/src/c.ts', count: 3 },
  { ruleId: 'rules/no-game-id-branching', file: 'apps/web/src/d.tsx', count: 1 },
];

describe('planGroomIssues', () => {
  it('opens one issue per baseline entry up to the cap and is idempotent', () => {
    const first = planGroomIssues(ENTRIES.slice(0, 2), []);
    expect(first).toHaveLength(2);
    expect(first[0]?.labels).toEqual(['groomer', 'agent-ready']);
    expect(first[0]?.body).toContain('eslint-rules/baseline.json');

    const second = planGroomIssues(
      ENTRIES.slice(0, 2),
      first.map((p) => p.title),
    );
    expect(second).toHaveLength(0);
  });

  it('caps new issues at 3 per run', () => {
    const planned = planGroomIssues(ENTRIES, []);
    expect(planned).toHaveLength(3);
    expect(planned.map((p) => p.title)).toEqual([
      groomIssueTitle(ENTRIES[0]!),
      groomIssueTitle(ENTRIES[1]!),
      groomIssueTitle(ENTRIES[2]!),
    ]);
  });
});
