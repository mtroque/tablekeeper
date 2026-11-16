import { describe, expect, it } from 'vitest';

import {
  checkForbiddenFiles,
  checkMigrations,
  checkOwnership,
  checkRuleIds,
  MAX_IMAGE_BYTES,
  parseSpecOwns,
} from '.';

const GAME_DOC = `
# Example Game

## Scoring rules

| ID | Rule |
|---|---|
| PAT-SCORE-1 | Final score = pralines + special tile - 2 per empty space. |
| PAT-SCORE-2 | A space is empty unless covered. |
| DOR-B1..B3 | Task markers. |
| DOR-D1, D2 | Longest track and stream. |
| HAR-SIDE-C-1 | ⚠️ VERIFY: side C center space. |
`;

describe('checkRuleIds', () => {
  it('passes when every defined rule id is cited in a test (including range shorthand) and every cited id is defined', () => {
    const tests = {
      'packages/core/src/games/patchwork/index.test.ts': `
        it('PAT-SCORE-1: final score', () => {});
        it('PAT-SCORE-2: empty space', () => {});
        it('DOR-B1..B3, DOR-D1, DOR-D2: tasks and longest', () => {});
      `,
    };
    expect(checkRuleIds({ 'docs/games/patchwork.md': GAME_DOC }, tests)).toEqual([]);
  });

  it('fails when a defined rule id has no test and when a test cites an unknown id', () => {
    const tests = {
      'packages/core/src/games/patchwork/index.test.ts': `
        it('PAT-SCORE-1: final score', () => {});
        it('PAT-SCORE-99: made up rule', () => {});
      `,
    };
    const failures = checkRuleIds({ 'docs/games/patchwork.md': GAME_DOC }, tests);
    expect(failures).toEqual([
      'docs/games/patchwork.md: rule DOR-B1 has no test naming it. Add a test with "DOR-B1" in its title (docs/CONVENTIONS.md → Testing).',
      'docs/games/patchwork.md: rule DOR-B2 has no test naming it. Add a test with "DOR-B2" in its title (docs/CONVENTIONS.md → Testing).',
      'docs/games/patchwork.md: rule DOR-B3 has no test naming it. Add a test with "DOR-B3" in its title (docs/CONVENTIONS.md → Testing).',
      'docs/games/patchwork.md: rule DOR-D1 has no test naming it. Add a test with "DOR-D1" in its title (docs/CONVENTIONS.md → Testing).',
      'docs/games/patchwork.md: rule DOR-D2 has no test naming it. Add a test with "DOR-D2" in its title (docs/CONVENTIONS.md → Testing).',
      'docs/games/patchwork.md: rule PAT-SCORE-2 has no test naming it. Add a test with "PAT-SCORE-2" in its title (docs/CONVENTIONS.md → Testing).',
      'packages/core/src/games/patchwork/index.test.ts: test cites unknown rule id PAT-SCORE-99. Define PAT-SCORE-99 in docs/games/<gameId>.md or fix the typo.',
    ]);
  });
});

describe('checkMigrations', () => {
  it('allows newly added migrations and files outside the migrations folder', () => {
    expect(
      checkMigrations([
        { status: 'A', path: 'supabase/migrations/20261116000000_new.sql' },
        { status: 'M', path: 'packages/core/src/index.ts' },
      ]),
    ).toEqual([]);
  });

  it('fails when an existing migration is modified, deleted or renamed', () => {
    expect(
      checkMigrations([
        { status: 'M', path: 'supabase/migrations/20261025103141_init.sql' },
        { status: 'D', path: 'supabase/migrations/20261025200000_rules_assistant.sql' },
      ]),
    ).toEqual([
      'supabase/migrations/20261025103141_init.sql: applied migration was modified (M). Never edit an existing migration; create a new one with supabase migration new <name> (docs/CONVENTIONS.md → Database).',
      'supabase/migrations/20261025200000_rules_assistant.sql: applied migration was deleted (D). Never edit an existing migration; create a new one with supabase migration new <name> (docs/CONVENTIONS.md → Database).',
    ]);
  });
});

describe('checkForbiddenFiles', () => {
  it('allows .env.example and images up to 2MB', () => {
    expect(
      checkForbiddenFiles([
        { path: '.env.example', sizeBytes: 1200 },
        { path: 'apps/web/public/samples/patchwork/red-board.jpg', sizeBytes: MAX_IMAGE_BYTES },
        { path: 'docs/PRODUCT.md', sizeBytes: 4000 },
      ]),
    ).toEqual([]);
  });

  it('fails on .env*, PDFs, data/rulebooks/*, and images over 2MB', () => {
    const failures = checkForbiddenFiles([
      { path: '.env.local', sizeBytes: 100 },
      { path: 'apps/api/.env.production', sizeBytes: 100 },
      { path: 'docs/rules.pdf', sizeBytes: 50_000 },
      { path: 'data/rulebooks/patchwork.sections.json', sizeBytes: 10_000 },
      { path: 'data/fixtures/patchwork/huge.jpg', sizeBytes: 3 * 1024 * 1024 },
    ]);
    expect(failures).toEqual([
      '.env.local: environment file is forbidden in git. Keep secrets in .env.local (gitignored) and document keys in .env.example (AGENTS.md → Hard rules).',
      'apps/api/.env.production: environment file is forbidden in git. Keep secrets in .env.local (gitignored) and document keys in .env.example (AGENTS.md → Hard rules).',
      'data/fixtures/patchwork/huge.jpg: image is 3.00MB, over the 2.00MB limit. Downscale or compress the photo before committing (AGENTS.md → Hard rules).',
      'data/rulebooks/patchwork.sections.json: files under data/rulebooks/ are forbidden in git. Keep rulebook PDFs and extracted sections local only (AGENTS.md → Hard rules).',
      'docs/rules.pdf: PDF files are forbidden in git. Link to the official publisher PDF instead (AGENTS.md → Hard rules).',
    ]);
  });

  it('fails on agent scratch files and allows real scripts and e2e specs', () => {
    const failures = checkForbiddenFiles([
      { path: '.scratch/find.mts', sizeBytes: 100 },
      { path: 'tests/e2e/zz-shot.spec.ts', sizeBytes: 100 },
      { path: 'scripts/_debug.ts', sizeBytes: 100 },
      { path: 'scripts/.x2tmp/run.ts', sizeBytes: 100 },
      { path: 'scripts/preflight.mjs', sizeBytes: 100 },
      { path: 'scripts/lib/_helpers.ts', sizeBytes: 100 },
      { path: 'tests/e2e/S1.spec.ts', sizeBytes: 100 },
    ]);
    const hint =
      'looks like an agent scratch file. Put throwaway scripts and screenshot specs in your own .scratch/<session or slice>/ (gitignored) instead (AGENTS.md → Parallel sessions).';
    expect(failures).toEqual([
      `.scratch/find.mts: ${hint}`,
      `scripts/.x2tmp/run.ts: ${hint}`,
      `scripts/_debug.ts: ${hint}`,
      `tests/e2e/zz-shot.spec.ts: ${hint}`,
    ]);
  });
});

describe('checkOwnership', () => {
  const S6_SPEC = `
# S6: Typed counters

## Owns
- \`apps/web/src/components/counter.tsx\` and \`apps/web/src/components/counter.test.tsx\`
- \`docs/UX.md\`
- \`tests/e2e/S6.spec.ts\`

## Scope
`;

  const P4_SPEC = `
# P4: Patchwork piece colors

## Owns
The \`patchwork\` game folders (AGENTS.md → Parallel sessions), plus this spec and \`tests/e2e/P4.spec.ts\`.

## Scope
`;

  it('expands game-folder shorthand and backticked globs', () => {
    const owns = parseSpecOwns('docs/slices/P4-patchwork-piece-colors.md', P4_SPEC);
    expect(owns).toContain('packages/cv/src/games/patchwork/');
    expect(owns).toContain('apps/web/src/games/patchwork/');
    expect(owns).toContain('tests/e2e/P4.spec.ts');
  });

  it('passes when a branch edits only owned files and adds lines to a wiring hub', () => {
    const res = checkOwnership({
      branch: 'slice/S6',
      specs: { 'docs/slices/S6-typed-counters.md': S6_SPEC },
      changedFiles: [
        { path: 'docs/slices/S6-typed-counters.md', removedLines: 2 },
        { path: 'apps/web/src/components/counter.tsx', removedLines: 5 },
        { path: 'packages/core/src/index.ts', removedLines: 0 },
      ],
    });
    expect(res).toEqual({ failures: [], notes: [] });
  });

  it('fails when a branch edits an unowned file or removes lines from a wiring hub', () => {
    const res = checkOwnership({
      branch: 'slice/S6',
      specs: { 'docs/slices/S6-typed-counters.md': S6_SPEC },
      changedFiles: [
        { path: 'docs/slices/S6-typed-counters.md', removedLines: 2 },
        { path: 'apps/api/src/server.ts', removedLines: 1 },
        { path: 'packages/core/src/index.ts', removedLines: 1 },
        { path: 'packages/core/src/kit/types.ts', removedLines: 0 },
      ],
    });
    expect(res.failures).toEqual([
      'apps/api/src/server.ts: not listed in ## Owns of docs/slices/S6-typed-counters.md. Edit only owned files, or request a shared change under ## Shared change requests (AGENTS.md → Parallel sessions).',
      'packages/core/src/index.ts: additive-wiring file has 1 removed/modified line(s), but docs/slices/S6-typed-counters.md does not own it. Keep existing lines untouched or add "packages/core/src/index.ts" to ## Owns / ## Shared change requests (AGENTS.md → Parallel sessions).',
      'packages/core/src/kit/types.ts: not listed in ## Owns of docs/slices/S6-typed-counters.md. Edit only owned files, or request a shared change under ## Shared change requests (AGENTS.md → Parallel sessions).',
    ]);
  });

  it('reports without failing on main or for W slices that touch shared files', () => {
    const onMain = checkOwnership({
      branch: 'main',
      specs: { 'docs/slices/S6-typed-counters.md': S6_SPEC },
      changedFiles: [{ path: 'docs/ROADMAP.md', removedLines: 1 }],
    });
    expect(onMain.failures).toEqual([]);
    expect(onMain.notes).toHaveLength(1);

    const wSlice = checkOwnership({
      branch: 'slice/W3',
      specs: { 'docs/slices/W3-repo-checks.md': '# W3\n\n## Owns\n- `scripts/check-repo.ts`\n' },
      changedFiles: [{ path: 'docs/ROADMAP.md', removedLines: 1 }],
    });
    expect(wSlice.failures).toEqual([]);
    expect(wSlice.notes).toHaveLength(1);
  });
});
