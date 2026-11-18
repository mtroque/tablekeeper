import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseFactoryConfig } from './config';
import { pickNextIssue, type QueueIssue } from './queue';
import { decryptSessionDir, encryptSessionDir } from './session';

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
        builder: { agent: 'claude', model: 'claude-sonnet-4-6' },
        reviewer: { agent: 'claude', model: 'claude-sonnet-4-6' },
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
