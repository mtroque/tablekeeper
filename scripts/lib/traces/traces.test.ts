import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { isWeeklyReportTitle, parseGradeMetrics, traceColumns } from '../metrics/grading';

import { parseAntigravityTranscript } from './antigravity';
import { CLASSES, classifyFailure, gradeSession } from './classify';
import { parseClaudeTranscript } from './claude';
import { claudeSlug, parseRange } from './collect';
import { condenseSession } from './condense';
import { parseGraderConfig } from './config';
import { buildJudgePrompt, correctionsIndex, parseJudgeOutput, sanitizeNote } from './judge';
import { formatReport, knownTagsFrom, proposedRows } from './report';
import { selectForJudging } from './select';
import type { Session, ToolEvent } from './types';

const FIXTURES = join(import.meta.dirname, 'fixtures');
const fixture = (name: string): string => readFileSync(join(FIXTURES, name), 'utf8');

function tool(
  name: string,
  input: Record<string, unknown>,
  error: string | null = null,
): ToolEvent {
  return { kind: 'tool', name, arg: '', input, error };
}

function session(events: Session['events'], cwd = '/repo'): Session {
  return {
    id: 'ffff0000-test',
    runner: 'claude',
    startedAt: '2026-11-10T09:00:00Z',
    endedAt: '2026-11-10T10:00:00Z',
    cwd,
    branch: 'slice/X1',
    models: [],
    tokens: { input: 0, output: 0 },
    events,
  };
}

const bash = (command: string, error: string | null = null): ToolEvent =>
  tool('Bash', { command }, error);

describe('parseClaudeTranscript', () => {
  const parsed = parseClaudeTranscript(fixture('claude-session.jsonl'));

  it('reads session id, cwd, branch, times, models and deduplicated tokens', () => {
    expect(parsed.id).toBe('aaaa1111-0000-4000-8000-000000000001');
    expect(parsed.cwd).toBe('/repo/.claude/worktrees/x1');
    expect(parsed.branch).toBe('worktree-x1');
    expect(parsed.startedAt).toBe('2026-11-10T09:00:01.000Z');
    expect(parsed.endedAt).toBe('2026-11-10T09:02:00.000Z');
    expect(parsed.models).toEqual(['claude-opus-5-5']);
    expect(parsed.tokens).toEqual({ input: 1150, output: 25 });
  });

  it('keeps user turns, tool calls with errors, interruptions and the final message', () => {
    expect(parsed.events.map((e) => e.kind)).toEqual([
      'user',
      'tool',
      'tool',
      'tool',
      'interrupt',
      'user',
      'final',
    ]);
    expect(parsed.events[0]).toEqual({ kind: 'user', text: '/build X1' });
    const tools = parsed.events.filter((e): e is ToolEvent => e.kind === 'tool');
    expect(tools.map((t) => t.arg)).toEqual([
      'ls .env.local',
      'scripts/_debug.ts',
      "cat <<'X' > /tmp/a.txt",
    ]);
    expect(tools[0]?.error).toContain('has been denied');
    expect(tools[1]?.error).toBeNull();
    expect(tools[2]?.error).toContain('was blocked');
    expect(parsed.events.at(-1)).toEqual({
      kind: 'final',
      text: 'Done: moved the helper to the scratch folder.',
    });
  });
});

describe('parseAntigravityTranscript', () => {
  const parsed = parseAntigravityTranscript(fixture('antigravity-transcript.jsonl'), 'conv-1');

  it('matches results to calls in order and marks failed steps', () => {
    const tools = parsed.events.filter((e): e is ToolEvent => e.kind === 'tool');
    expect(tools.map((t) => [t.name, t.arg, t.error === null])).toEqual([
      ['run_command', 'pnpm typecheck', false],
      ['view_file', '/repo/docs/OLD.md', false],
      ['run_command', 'pnpm typecheck', true],
    ]);
    expect(parsed.events[0]).toEqual({ kind: 'user', text: 'Build slice X2' });
    expect(parsed.events.at(-1)).toEqual({ kind: 'final', text: 'All checks pass.' });
  });

  it('records model switches and tokens per step', () => {
    expect(parsed.models).toEqual(['gemini-4-pro', 'claude-opus-5-5']);
    expect(parsed.tokens).toEqual({ input: 3900, output: 110 });
    expect(parsed.startedAt).toBe('2026-11-15T10:00:00Z');
  });

  it('classifies the failures', () => {
    const graded = gradeSession(parsed);
    expect(graded.metrics.failuresByClass).toEqual({ 'check-failed': 1, 'missing-file': 1 });
  });
});

describe('classifyFailure', () => {
  const main = session([]);
  const worktree = session([], '/repo/.claude/worktrees/x1');
  const cases: [string, ToolEvent, Session, string][] = [
    [
      'worktree guard',
      bash(
        'cd /tmp',
        "cd to '/tmp' was blocked. For security, Claude Code may only change directories to child directories",
      ),
      main,
      'worktree-guard',
    ],
    [
      'approval refusal inside a worktree',
      bash('for f in *; do echo $f; done', 'This command requires approval'),
      worktree,
      'worktree-guard',
    ],
    [
      'denied .env.local read',
      tool('Read', { file_path: '/repo/.env.local' }, 'Permission to use Read has been denied.'),
      main,
      'env-file-denied',
    ],
    [
      'classifier denial',
      bash('curl https://example.com', 'This command was blocked by the auto mode classifier'),
      main,
      'permission-denied',
    ],
    [
      'user rejection',
      bash('git push', "The user doesn't want to proceed with this tool use."),
      main,
      'user-rejected',
    ],
    [
      'commit-msg hook',
      bash(
        'git commit -m "update"',
        '✖   subject may not be empty [subject-empty]\n✖   found 2 problems',
      ),
      main,
      'commit-msg-hook',
    ],
    [
      'pre-commit hook',
      bash(
        'git commit -m "feat(web): x"',
        '$ tsx scripts/check-repo.ts --staged\nscripts/_x.ts: looks like a scratch file',
      ),
      main,
      'pre-commit-hook',
    ],
    [
      'missing file',
      tool('Read', { file_path: '/repo/docs/OLD.md' }, 'File does not exist.'),
      main,
      'missing-file',
    ],
    ['failing check', bash('pnpm verify', 'Exit code 1\ntest  fail'), main, 'check-failed'],
    ['search without match', bash('grep -rn foo src', 'Exit code 1'), main, 'check-failed'],
    [
      'unknown error',
      bash('docker ps', 'Cannot connect to the Docker daemon'),
      main,
      'unclassified',
    ],
  ];
  it.each(cases)('%s', (_name, event, s, expected) => {
    expect(classifyFailure(event, s)).toBe(expected);
  });
});

describe('gradeSession behaviors', () => {
  it('flags scratch writes, scratch deletion, repeated calls and e2e reruns', () => {
    const graded = gradeSession(
      session([
        { kind: 'user', text: 'go' },
        tool('Write', { file_path: '/repo/tests/e2e/zz-shot.spec.ts', content: 'x' }),
        bash('echo hi > scripts/.h2'),
        bash("cat > fixtures/a.jsonl <<'EOF'\nsee scripts/_debug.ts\nEOF"),
        bash('pnpm exec tsx .scratch/s/a.mts && rm -rf .scratch'),
        bash('rm -rf .scratch/w16'),
        bash('pnpm test:e2e', 'Exit code 1'),
        bash('git status'),
        bash('git status'),
        bash('pnpm test:e2e'),
        { kind: 'interrupt' },
      ]),
    );
    expect(graded.metrics.behaviors).toEqual({
      'scratch-outside': 2,
      'scratch-dir-deleted': 1,
      'repeated-command': 1,
      'e2e-rerun': 1,
    });
    expect(graded.metrics).toMatchObject({
      toolCalls: 9,
      failed: 1,
      userTurns: 1,
      interruptions: 1,
    });
  });

  it('finds the fixture worktree patterns', () => {
    const graded = gradeSession(parseClaudeTranscript(fixture('claude-session.jsonl')));
    expect(graded.findings.map((f) => f.cls)).toEqual([
      'env-file-denied',
      'scratch-outside',
      'worktree-guard',
    ]);
  });
});

describe('condenseSession', () => {
  it('summarizes long runs of successful calls and keeps errors with their class', () => {
    const events: Session['events'] = [{ kind: 'user', text: 'go' }];
    for (let i = 0; i < 10; i++) events.push(tool('Read', { file_path: `/repo/f${i}.ts` }));
    events.push(bash('docker ps', 'daemon not running'));
    const text = condenseSession(
      gradeSession(
        session(
          events.map((e) =>
            e.kind === 'tool'
              ? { ...e, arg: (e.input.file_path as string | undefined) ?? 'docker ps' }
              : e,
          ),
        ),
      ),
    );
    expect(text).toContain('T: ... 7 more calls (Read 7)');
    expect(text).toContain('T: Bash: docker ps\n  ! [unclassified] daemon not running');
    expect(condenseSession(gradeSession(session(events)), 1000).length).toBeLessThanOrEqual(1000);
  });
});

describe('selectForJudging', () => {
  it('judges flagged sessions first, then a seeded sample, capped', () => {
    const make = (id: string, events: Session['events']) =>
      gradeSession({ ...session(events), id });
    const sessions = [
      make('clean-1', [bash('ls')]),
      make('unknown', [bash('docker ps', 'daemon')]),
      make('guard', [bash('cd /tmp', 'was blocked. For security')]),
    ];
    const picks = selectForJudging(sessions, {
      sampleRate: 0,
      flagTop: 1,
      maxJudged: 5,
      seed: 'w',
    });
    expect(picks).toEqual([
      { id: 'guard', reason: 'flagged' },
      { id: 'unknown', reason: 'flagged' },
    ]);
    const all = selectForJudging(sessions, { sampleRate: 1, flagTop: 0, maxJudged: 2, seed: 'w' });
    expect(all).toEqual([
      { id: 'unknown', reason: 'flagged' },
      { id: 'clean-1', reason: 'sample' },
    ]);
  });
});

describe('report', () => {
  const log =
    '| 2026-11-16 | `worktree-command-refused` | 14 sessions | x | y | trace | promoted: z |';
  const graded = [
    gradeSession(
      session([bash('cd /tmp', 'was blocked. For security'), bash('pnpm test', 'fail')]),
      12,
    ),
  ];

  it('proposes rows with existing tags and no transcript text', () => {
    const rows = proposedRows(graded, knownTagsFrom(log));
    expect(rows).toEqual([
      expect.objectContaining({ tag: 'worktree-command-refused', occurrences: 1, newTag: false }),
    ]);
    const report = formatReport({
      week: '2026-W46',
      since: '2026-11-09',
      until: '2026-11-15',
      source: 'local',
      sessions: graded,
      judged: [
        {
          id: 'ffff0000-test',
          reason: 'flagged',
          results: [
            {
              rubric: 'efficiency',
              label: 'spinning',
              pass: false,
              note: 'Retried refused commands.',
            },
          ],
          tokens: 900,
        },
      ],
      judgeTokens: 900,
      knownTags: knownTagsFrom(log),
      date: '2026-11-16',
    });
    expect(report).toContain('# Grading report 2026-W46');
    expect(report).toContain(
      `| 2026-11-16 | \`worktree-command-refused\` | 1 session, 1 call: ffff0000 (#12) | ${CLASSES['worktree-guard'].wrong}`,
    );
    expect(report).not.toContain('cd /tmp');
    expect(report).not.toContain('was blocked');
    expect(parseGradeMetrics(report)).toEqual({
      week: '2026-W46',
      sessions: 1,
      toolCalls: 2,
      failed: 2,
      byClass: { 'worktree-guard': 1, 'check-failed': 1 },
    });
  });

  it('feeds the metrics columns', () => {
    const trace = parseGradeMetrics(
      '<!-- grade-metrics {"week":"2026-W46","sessions":4,"toolCalls":90,"failed":10,"byClass":{"check-failed":6,"worktree-guard":3,"missing-file":1}} -->',
    );
    expect(traceColumns(trace ?? undefined)).toEqual({
      perSession: '2.5',
      top: 'worktree-guard 3, missing-file 1',
    });
    expect(traceColumns(undefined)).toEqual({ perSession: '-', top: '-' });
    expect(parseGradeMetrics('no block')).toBeNull();
    expect(isWeeklyReportTitle('Grading report 2026-W47')).toBe(true);
    expect(isWeeklyReportTitle('Grading report 2026-11-10 to 2026-11-12')).toBe(false);
  });
});

describe('judge', () => {
  it('builds a prompt with the rubrics, the log index and the trace', () => {
    const prompt = buildJudgePrompt(
      [{ name: 'efficiency', body: '# Efficiency' }],
      'T: Bash: ls',
      correctionsIndex('| 2026-11-16 | `a-tag` | main | w | c | trace | open |'),
    );
    expect(prompt).toContain('## Rubric `efficiency`');
    expect(prompt).toContain('2026-11-16 `a-tag` main');
    expect(prompt.endsWith('T: Bash: ls')).toBe(true);
  });

  it('reads structured output and tokens, dropping unknown rubrics and quotes', () => {
    const stdout = JSON.stringify({
      type: 'result',
      result: '',
      structured_output: {
        results: [
          {
            rubric: 'efficiency',
            label: 'spinning',
            pass: false,
            note: 'Ran "pnpm test" 5 times; see `x`.',
          },
          { rubric: 'made-up', label: 'x', pass: true, note: '' },
        ],
      },
      usage: { input_tokens: 800, output_tokens: 40, cache_read_input_tokens: 100 },
    });
    expect(parseJudgeOutput(stdout, ['efficiency'])).toEqual({
      results: [
        {
          rubric: 'efficiency',
          label: 'spinning',
          pass: false,
          note: 'Ran [quote] 5 times; see [code].',
        },
      ],
      tokens: 940,
    });
    expect(parseJudgeOutput('not json', ['efficiency'])).toEqual({ results: null, tokens: 0 });
    expect(sanitizeNote('x '.repeat(100))).toHaveLength(160);
    expect(
      sanitizeNote(
        'Read docs/OLD.md and .env.local, then used ghp_abcdefghijklmnopqrstuvwxyz0123 twice.',
      ),
    ).toBe('Read [path] and [path], then used [redacted] twice.');
  });
});

describe('config and collect helpers', () => {
  it('parses the grader block with defaults', () => {
    const config = parseGraderConfig(
      JSON.stringify({ builder: {}, grader: { agent: 'claude', model: 'claude-haiku-5-5' } }),
    );
    expect(config).toMatchObject({ effort: 'low', sampleRate: 0.1, maxJudged: 10 });
    const repoConfig = parseGraderConfig(
      readFileSync(join(import.meta.dirname, '../../../.github/factory/config.json'), 'utf8'),
    );
    expect(repoConfig.effort).toBe('low');
  });

  it('slugs paths like Claude Code and parses inclusive day ranges', () => {
    expect(claudeSlug('/home/me/tablekeeper/.claude/worktrees/a')).toBe(
      '-home-me-tablekeeper--claude-worktrees-a',
    );
    const range = parseRange('2026-10-23', '2026-11-16');
    expect(range.until.toISOString()).toBe('2026-11-16T23:59:59.999Z');
    expect(() => parseRange('2026-11-16', '2026-10-23')).toThrow(/Invalid date range/);
  });
});
