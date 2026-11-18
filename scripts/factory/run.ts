// Headless factory runner invoked by .github/workflows/factory.yml.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { z } from 'zod';

import { loadFactoryConfig } from './config';
import { readFactoryProjectOrder } from './project';
import { extractSliceId, pickNextIssue, type QueueIssue } from './queue';
import { claudeProjectDir, encryptSessionDir } from './session';
import { markCheckoutTrusted } from './trust';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');

const GhIssueSchema = z.object({
  number: z.number(),
  title: z.string(),
  body: z.string(),
  labels: z.array(z.object({ name: z.string() })),
});

const GhPrSchema = z.object({
  number: z.number(),
  headRefName: z.string(),
  body: z.string(),
  url: z.string(),
});

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .replaceAll(/[^a-z0-9]+/g, '-')
      .replaceAll(/^-+|-+$/g, '')
      .slice(0, 32) || 'task'
  );
}

function parseSessionIdFromStream(jsonl: string): string | null {
  for (const line of jsonl.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const obj = JSON.parse(trimmed) as { session_id?: unknown };
      if (typeof obj.session_id === 'string' && obj.session_id) return obj.session_id;
    } catch {
      // Ignore non-JSON lines.
    }
  }
  return null;
}

function listOpenIssues(): QueueIssue[] {
  const rawIssues = execFileSync(
    'gh',
    ['issue', 'list', '--state', 'open', '--limit', '200', '--json', 'number,title,body,labels'],
    { cwd: ROOT, encoding: 'utf8' },
  );
  const rawPrs = execFileSync(
    'gh',
    ['pr', 'list', '--state', 'open', '--limit', '100', '--json', 'number,headRefName,body,url'],
    { cwd: ROOT, encoding: 'utf8' },
  );
  const issues = z.array(GhIssueSchema).parse(JSON.parse(rawIssues));
  const prs = z.array(GhPrSchema).parse(JSON.parse(rawPrs));

  return issues.map((issue) => ({
    number: issue.number,
    title: issue.title,
    body: issue.body,
    labels: issue.labels.map((l) => l.name),
    hasOpenPr: prs.some(
      (pr) =>
        pr.headRefName.startsWith(`factory/${issue.number}-`) ||
        pr.body.includes(`Closes #${issue.number}`),
    ),
  }));
}

function main(): void {
  const config = loadFactoryConfig(join(ROOT, '.github/factory/config.json'));
  if (!config.enabled) {
    console.log('Factory disabled in .github/factory/config.json.');
    return;
  }

  const repoFull = process.env.GITHUB_REPOSITORY ?? '';
  const [owner = '', repo = ''] = repoFull.split('/');
  const requestedNum = process.env.FACTORY_ISSUE_NUMBER
    ? Number.parseInt(process.env.FACTORY_ISSUE_NUMBER, 10)
    : null;

  const issues = listOpenIssues();
  const { order } = owner && repo ? readFactoryProjectOrder(owner, repo) : { order: [] };
  const roadmap = readFileSync(join(ROOT, 'docs/ROADMAP.md'), 'utf8');

  const picked = requestedNum
    ? (issues.find((i) => i.number === requestedNum) ?? null)
    : pickNextIssue(issues, order, roadmap);

  if (!picked) {
    console.log('No eligible agent-ready issue in the queue.');
    return;
  }

  const branch = `factory/${picked.number}-${slugify(picked.title)}`;
  execFileSync('gh', ['issue', 'edit', String(picked.number), '--add-label', 'in-progress'], {
    cwd: ROOT,
  });

  try {
    execFileSync('git', ['switch', '-c', branch], { cwd: ROOT });
    markCheckoutTrusted(ROOT);

    const sliceId = extractSliceId(picked);
    const prompt = sliceId ? `/build ${sliceId}` : `/issue ${picked.number}`;
    const streamPath = join(ROOT, '.scratch', `factory-${picked.number}`, 'stream.jsonl');
    mkdirSync(dirname(streamPath), { recursive: true });

    const res = spawnSync(
      'claude',
      [
        '-p',
        prompt,
        '--model',
        config.builder.model,
        '--effort',
        config.builder.effort,
        '--max-turns',
        String(config.builder.maxTurns),
        '--output-format',
        'stream-json',
        '--verbose',
      ],
      {
        cwd: ROOT,
        encoding: 'utf8',
        timeout: config.builder.timeoutMinutes * 60_000,
        env: { ...process.env, FACTORY_ISSUE_NUMBER: String(picked.number) },
      },
    );

    const output = `${res.stdout}\n${res.stderr}`;
    writeFileSync(streamPath, output);

    const sessionId = parseSessionIdFromStream(res.stdout);
    const sessionKey = process.env.FACTORY_SESSION_KEY ?? '';
    if (sessionId && sessionKey) {
      const sessionDir = claudeProjectDir(ROOT);
      if (existsSync(sessionDir)) {
        const encPath = join(ROOT, '.scratch', `session-${sessionId}.tar.gz.enc`);
        encryptSessionDir(sessionDir, encPath, sessionKey);
        if (process.env.GITHUB_OUTPUT) {
          writeFileSync(
            process.env.GITHUB_OUTPUT,
            `session_id=${sessionId}\nsession_file=${encPath}\n`,
            {
              flag: 'a',
            },
          );
        }
      }
    }

    if (/rate limit|usage limit|quota/i.test(output) && res.status !== 0) {
      console.log(`Usage limit hit on #${picked.number}; returning issue to queue.`);
      execFileSync(
        'gh',
        ['issue', 'edit', String(picked.number), '--remove-label', 'in-progress'],
        {
          cwd: ROOT,
        },
      );
      return;
    }

    const prsRaw = execFileSync(
      'gh',
      ['pr', 'list', '--state', 'open', '--head', branch, '--json', 'number,url'],
      { cwd: ROOT, encoding: 'utf8' },
    );
    const openedPrs = z
      .array(z.object({ number: z.number(), url: z.string() }))
      .parse(JSON.parse(prsRaw));

    if (res.status === 0 && openedPrs.length > 0) {
      execFileSync(
        'gh',
        ['issue', 'edit', String(picked.number), '--remove-label', 'in-progress'],
        {
          cwd: ROOT,
        },
      );
      console.log(`Opened PR ${openedPrs[0]?.url ?? ''} for #${picked.number}`);
      return;
    }

    const runUrl = process.env.GITHUB_RUN_ID
      ? `https://github.com/${repoFull}/actions/runs/${process.env.GITHUB_RUN_ID}`
      : '';
    execFileSync(
      'gh',
      [
        'issue',
        'comment',
        String(picked.number),
        '--body',
        `Factory run did not open a PR (exit ${res.status ?? 'null'}).${runUrl ? ` Run: ${runUrl}` : ''}`,
      ],
      { cwd: ROOT },
    );
    execFileSync(
      'gh',
      [
        'issue',
        'edit',
        String(picked.number),
        '--remove-label',
        'in-progress',
        '--add-label',
        'needs-human',
      ],
      { cwd: ROOT },
    );
    process.exitCode = 1;
  } catch (error) {
    execFileSync('gh', ['issue', 'edit', String(picked.number), '--remove-label', 'in-progress'], {
      cwd: ROOT,
    });
    throw error;
  }
}

main();
