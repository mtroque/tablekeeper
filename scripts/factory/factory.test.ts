import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseFactoryConfig } from './config';
import { pausedSliceFollowUp, specStatusLine } from './finish';
import { readFactoryProjectOrder } from './project';
import { explainQueue, pickNextIssue, type QueueIssue } from './queue';
import { decryptSessionDir, encryptSessionDir } from './session';
import { sessionIdFromStreamFile, spawnToFiles, tailOfFile } from './stream';

const SAMPLE_ROADMAP = [
  '| ID | Slice | Depends on | Status |',
  '|---|---|---|---|',
  '| W1 | CI | - | ✅ |',
  '| W4 | PR | W1 | ✅ |',
  '| P1 | Patchwork | - | ✅ |',
  '| P4 | Patchwork colors | P1 | ⬜ |',
  '| H5 | Harmonies C/D | H4 | ⬜ |',
  '| H4 | Harmonies Whispers | - | ⬜ |',
].join('\n');

describe('parseFactoryConfig', () => {
  it('parses valid config and applies defaults', () => {
    const cfg = parseFactoryConfig(
      JSON.stringify({
        builder: { agent: 'claude', model: 'claude-opus-5-5' },
        reviewer: { agent: 'claude', model: 'claude-sonnet-5-5' },
      }),
    );
    expect(cfg.enabled).toBe(true);
    expect(cfg.tasksPerRun).toBe(1);
    expect(cfg.builder.effort).toBe('medium');
  });

  it('rejects unknown agents', () => {
    expect(() =>
      parseFactoryConfig(
        JSON.stringify({
          builder: { agent: 'unknown', model: 'x' },
          reviewer: { agent: 'claude', model: 'y' },
        }),
      ),
    ).toThrow();
  });
});

describe('pickNextIssue', () => {
  const base: QueueIssue[] = [
    {
      number: 1,
      title: 'P4: colors',
      body: 'Spec: docs/slices/P4-colors.md',
      labels: ['agent-ready'],
      hasOpenPr: false,
    },
    {
      number: 2,
      title: 'H5: sides C and D',
      body: 'Spec: docs/slices/H5-sides.md',
      labels: ['agent-ready'],
      hasOpenPr: false,
    },
    {
      number: 3,
      title: 'chore(lint): cleanup',
      body: '',
      labels: ['agent-ready', 'groomer'],
      hasOpenPr: false,
      blockedBy: [99],
    },
    {
      number: 99,
      title: 'blocker',
      body: '',
      labels: [],
      hasOpenPr: false,
    },
  ];

  it('respects Project order and skips blocked or ineligible issues', () => {
    // Issue 2 is first in Project order, but H5 depends on H4 which is not ✅, so it picks issue 1.
    expect(pickNextIssue(base, [2, 3, 1, 99], SAMPLE_ROADMAP)?.number).toBe(1);
  });

  it('skips needs-human, in-progress, open PRs, and unready issues', () => {
    const filtered: QueueIssue[] = [
      { ...base[0]!, labels: ['agent-ready', 'needs-human'] },
      { ...base[1]!, labels: ['agent-ready', 'in-progress'] },
      { number: 4, title: 'has pr', body: '', labels: ['agent-ready'], hasOpenPr: true },
    ];
    expect(pickNextIssue(filtered, [1, 2, 4], SAMPLE_ROADMAP)).toBeNull();
  });

  it('explainQueue returns ordered steps with skip reasons for dry run', () => {
    const explanation = explainQueue(base, [2, 3, 1, 99], SAMPLE_ROADMAP);
    expect(explanation.picked?.number).toBe(1);
    expect(explanation.steps.map((s) => [s.issue.number, s.status, s.reason])).toEqual([
      [2, 'skipped', 'slice H5 depends on H4 (⬜)'],
      [3, 'skipped', 'blocked by open issue #99'],
      [1, 'picked', undefined],
      [99, 'skipped', 'queued after #1'],
    ]);
  });
});

describe('readFactoryProjectOrder', () => {
  const okPayload = JSON.stringify({
    data: {
      repository: {
        owner: {
          projectV2: {
            id: 'PVT_1',
            items: {
              nodes: [
                { id: '1', rank: null, content: { number: 12 } },
                { id: '2', rank: null, content: { number: 7 } },
              ],
            },
          },
        },
      },
    },
  });

  it('reads with FACTORY_PROJECT_TOKEN first when it is set, without trying the App token', () => {
    const tried: (string | undefined)[] = [];
    const result = readFactoryProjectOrder('mtroque', 'tablekeeper', 1, {
      primaryToken: 'app-tok',
      projectToken: 'pat-tok',
      execGraphql: (_q, token) => {
        tried.push(token);
        return okPayload;
      },
    });
    expect(result).toEqual({ projectId: 'PVT_1', order: [12, 7], usedProjectToken: true });
    expect(tried).toEqual(['pat-tok']);
  });

  it('falls back to the App token when FACTORY_PROJECT_TOKEN is refused', () => {
    const result = readFactoryProjectOrder('mtroque', 'tablekeeper', 1, {
      primaryToken: 'app-tok',
      projectToken: 'pat-tok',
      execGraphql: (_q, token) => {
        if (token === 'pat-tok') throw new Error('Bad credentials');
        return okPayload;
      },
    });
    expect(result).toEqual({ projectId: 'PVT_1', order: [12, 7] });
  });

  it('uses the App token alone when FACTORY_PROJECT_TOKEN is not set', () => {
    const tried: (string | undefined)[] = [];
    readFactoryProjectOrder('mtroque', 'tablekeeper', 1, {
      primaryToken: 'app-tok',
      projectToken: '',
      execGraphql: (_q, token) => {
        tried.push(token);
        return okPayload;
      },
    });
    expect(tried).toEqual(['app-tok']);
  });

  it('throws a clear error when neither token can read the Project', () => {
    expect(() =>
      readFactoryProjectOrder('mtroque', 'tablekeeper', 1, {
        primaryToken: 'app-tok',
        projectToken: '',
        execGraphql: () => {
          throw new Error('Resource not accessible by integration');
        },
      }),
    ).toThrow(/FACTORY_PROJECT_TOKEN/);
  });
});

describe('session encrypt/decrypt', () => {
  it('round-trips a session directory and fails clearly with the wrong key', () => {
    const root = mkdtempSync(join(tmpdir(), 'tk-factory-test-'));
    try {
      const src = join(root, 'src');
      const out = join(root, 'session.tar.gz.enc');
      const restored = join(root, 'restored');
      const nested = join(src, 'abc');
      mkdirSync(nested, { recursive: true });
      writeFileSync(join(nested, 'session.jsonl'), '{"session_id":"abc"}\n');

      encryptSessionDir(src, out, 'secret-key-123');
      decryptSessionDir(out, restored, 'secret-key-123');
      expect(readFileSync(join(restored, 'abc', 'session.jsonl'), 'utf8')).toBe(
        '{"session_id":"abc"}\n',
      );

      expect(() => {
        decryptSessionDir(out, join(root, 'bad'), 'wrong-key');
      }).toThrow(/wrong key/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('spawnToFiles', () => {
  const dir = mkdtempSync(join(tmpdir(), 'tk-stream-'));
  // A child that prints a session id, then 70MB, then exits 3: past PR #26's 64MB buffer.
  const script = [
    "process.stdout.write(JSON.stringify({ type: 'system', session_id: 'sess-123' }) + '\\n');",
    "const line = 'x'.repeat(1024 * 1024 - 1) + '\\n';",
    'for (let i = 0; i < 70; i++) process.stdout.write(line);',
    "process.stderr.write('boom\\n');",
    'process.exitCode = 3;',
  ].join('\n');

  it('writes output of any size to files and still yields the session id on failure', () => {
    const stdoutPath = join(dir, 'stream.jsonl');
    const stderrPath = join(dir, 'stderr.log');
    const res = spawnToFiles(process.execPath, ['-e', script], {
      cwd: dir,
      stdoutPath,
      stderrPath,
    });
    expect(res.error).toBeUndefined();
    expect(res.status).toBe(3);
    expect(readFileSync(stdoutPath).length).toBeGreaterThan(70 * 1024 * 1024);
    expect(sessionIdFromStreamFile(stdoutPath)).toBe('sess-123');
    expect(tailOfFile(stderrPath, 5)).toEqual(['boom']);
    rmSync(dir, { recursive: true, force: true });
  });

  it('finds no session id in a missing or non-JSON file', () => {
    expect(sessionIdFromStreamFile(join(tmpdir(), 'tk-no-such-file.jsonl'))).toBeNull();
  });
});

describe('pausedSliceFollowUp', () => {
  const spec =
    '# W10: Screen map\n\n**Status:** ⏸ (waiting on the owner: move screens.yml) · **Depends on:** W7\n';

  it('turns Closes into Refs and gives the status as the reason while the spec is on the branch', () => {
    const result = pausedSliceFollowUp('## Slice\n\n- Closes #16\n- See #160', 16, spec);
    expect(result).toEqual({
      body: '## Slice\n\n- Refs #16\n- See #160',
      bodyChanged: true,
      reason: '⏸ (waiting on the owner: move screens.yml)',
    });
  });

  it('also catches Fixes and Resolves, and only for this issue', () => {
    expect(pausedSliceFollowUp('fixes #16, resolves #16, closes #17', 16, spec)?.body).toBe(
      'Refs #16, Refs #16, closes #17',
    );
  });

  it('still hands a paused slice to a human when the body never said Closes', () => {
    expect(pausedSliceFollowUp('Refs #16', 16, spec)).toMatchObject({ bodyChanged: false });
  });

  it('leaves a folded slice alone', () => {
    expect(pausedSliceFollowUp('Closes #16', 16, null)).toBeNull();
  });

  it('reads the status line without its dependencies', () => {
    expect(specStatusLine('**Status:** 🟨 · **Depends on:** none')).toBe('🟨');
  });
});
