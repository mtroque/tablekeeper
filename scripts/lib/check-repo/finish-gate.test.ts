import { describe, expect, it } from 'vitest';

import { checkFinishGate, roadmapStatuses, uncheckedCriteria } from './finish-gate';

const spec = (...criteria: string[]) =>
  [
    '# W9: Example',
    '',
    '## Owns',
    '- [ ] not a criterion, outside the section',
    '',
    '## Acceptance criteria',
    ...criteria,
    '',
    '## Tests',
    '- [ ] also outside',
  ].join('\n');

const roadmap = (status: string) =>
  [
    '| ID | Slice | Depends on | Status |',
    '|---|---|---|---|',
    `| W9 | Example | - | ${status} |`,
  ].join('\n');

describe('uncheckedCriteria and roadmapStatuses', () => {
  it('reads only unchecked lines under Acceptance criteria', () => {
    expect(uncheckedCriteria(spec('- [x] done', '- [ ] open one'))).toEqual(['open one']);
  });

  it('reads the status column of each roadmap row', () => {
    expect(roadmapStatuses(roadmap('✅')).get('W9')).toBe('✅');
  });
});

describe('checkFinishGate', () => {
  const path = 'docs/slices/W9-example.md';

  it('passes when every criterion of a removed spec is checked', () => {
    expect(
      checkFinishGate({ deletedSpecs: { [path]: spec('- [x] a', '- [x] b') }, currentSpecs: {} }),
    ).toEqual([]);
  });

  it('fails on an unchecked criterion and quotes it', () => {
    const failures = checkFinishGate({
      deletedSpecs: { [path]: spec('- [x] a', '- [ ] works live') },
      currentSpecs: {},
    });
    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain('(it is unchecked): "works live"');
  });

  it('passes a criterion moved to a spec that exists, and fails one moved to a missing spec', () => {
    const moved = { [path]: spec('- [ ] works live (moved to W24)') };
    expect(
      checkFinishGate({ deletedSpecs: moved, currentSpecs: { 'docs/slices/W24-go-live.md': '' } }),
    ).toEqual([]);
    const failures = checkFinishGate({ deletedSpecs: moved, currentSpecs: {} });
    expect(failures[0]).toContain("docs/slices/W24-*.md doesn't exist");
  });

  it('fails when a roadmap row turns ✅ while its spec still has open criteria', () => {
    const failures = checkFinishGate({
      deletedSpecs: {},
      currentSpecs: { [path]: spec('- [ ] still open') },
      roadmapBase: roadmap('⬜'),
      roadmapHead: roadmap('✅'),
    });
    expect(failures).toEqual([
      'docs/ROADMAP.md: W9 is marked ✅ while docs/slices/W9-example.md has 1 unchecked criteria, first: "still open". Finish or move them first (AGENTS.md → Definition of done, item 2).',
    ]);
  });

  it('ignores a row that was already ✅ and a ✅ row with no spec left', () => {
    expect(
      checkFinishGate({
        deletedSpecs: {},
        currentSpecs: { [path]: spec('- [ ] open') },
        roadmapBase: roadmap('✅'),
        roadmapHead: roadmap('✅'),
      }),
    ).toEqual([]);
    expect(
      checkFinishGate({
        deletedSpecs: {},
        currentSpecs: {},
        roadmapBase: roadmap('⬜'),
        roadmapHead: roadmap('✅'),
      }),
    ).toEqual([]);
  });
});
