// pnpm metrics [--weeks 4]
// Prints a deterministic weekly report of merged PRs, reverts, CI first-pass rate, factory runs,
// lint baseline leftovers, and docs/CORRECTIONS.md patterns.
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { z } from 'zod';

import { formatShadowAgreement, type ShadowPr } from './lib/metrics/agreement';
import { formatAuditLine, parseAuditCounts } from './lib/metrics/audit';
import { parseBaselineEntries } from './lib/metrics/baseline';
import { countCorrections } from './lib/metrics/corrections';
import { formatMetricsReport } from './lib/metrics/format';
import { bucketByWeek, extractRevertedPrs, lastNWeeks } from './lib/metrics/reverts';
import type { GitCommit, MergedPr } from './lib/metrics/types';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const GhPrSchema = z.object({
  number: z.number(),
  title: z.string(),
  headRefName: z.string(),
  mergedAt: z.string(),
  mergeCommit: z.object({ oid: z.string() }).nullable(),
  labels: z.array(z.object({ name: z.string() })),
  reviews: z.array(z.object({ author: z.object({ login: z.string() }).nullable() })).optional(),
});

function parseWeeksArg(argv: readonly string[]): number {
  const idx = argv.indexOf('--weeks');
  if (idx === -1) return 4;
  const val = Number.parseInt(argv[idx + 1] ?? '', 10);
  if (!Number.isFinite(val) || val < 1) {
    console.error('Usage: pnpm metrics [--weeks <n>]');
    process.exit(2);
  }
  return val;
}

function readGitCommits(): GitCommit[] {
  const sep = '\u001e';
  const fieldSep = '\u001f';
  const raw = execFileSync(
    'git',
    ['log', '--max-count=500', `--format=%H${fieldSep}%s${fieldSep}%b${sep}`],
    {
      cwd: ROOT,
      encoding: 'utf8',
    },
  );
  return raw
    .split(sep)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [sha = '', subject = '', body = ''] = entry.split(fieldSep);
      return { sha, subject, body };
    });
}

function readMergedPrs(): MergedPr[] {
  try {
    const raw = execFileSync(
      'gh',
      [
        'pr',
        'list',
        '--state',
        'merged',
        '--limit',
        '200',
        '--json',
        'number,title,headRefName,mergedAt,mergeCommit,labels,reviews',
      ],
      { cwd: ROOT, encoding: 'utf8' },
    );
    const parsed = z.array(GhPrSchema).parse(JSON.parse(raw));
    return parsed.map((pr) => ({
      number: pr.number,
      title: pr.title,
      headRefName: pr.headRefName,
      mergedAt: pr.mergedAt,
      mergeCommitSha: pr.mergeCommit?.oid ?? null,
      labels: pr.labels.map((l) => l.name),
      reviewRounds: pr.reviews && pr.reviews.length > 0 ? pr.reviews.length : null,
      firstPushPassed: null,
    }));
  } catch {
    return [];
  }
}

const ShadowPrSchema = z.object({
  number: z.number(),
  headRefName: z.string(),
  state: z.enum(['OPEN', 'MERGED', 'CLOSED']),
  headRefOid: z.string(),
  closedAt: z.string().nullable(),
  comments: z.array(z.object({ body: z.string() })),
});

/** Factory PRs with their comments, for W19's shadow agreement; empty when gh fails. */
function readFactoryPrs(): ShadowPr[] {
  try {
    const raw = execFileSync(
      'gh',
      [
        'pr',
        'list',
        '--state',
        'all',
        '--limit',
        '200',
        '--json',
        'number,headRefName,state,headRefOid,closedAt,comments',
      ],
      { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
    );
    return z
      .array(ShadowPrSchema)
      .parse(JSON.parse(raw))
      .filter((pr) => pr.headRefName.startsWith('factory/'))
      .map((pr) => ({
        number: pr.number,
        state: pr.state,
        headSha: pr.headRefOid,
        closedAt: pr.closedAt,
        comments: pr.comments.map((c) => c.body),
      }));
  } catch {
    return [];
  }
}

const weeksCount = parseWeeksArg(process.argv.slice(2));
const weeks = lastNWeeks(weeksCount);
const commits = readGitCommits();
const prs = readMergedPrs();
const reverted = extractRevertedPrs(commits, prs);
const weekMetrics = bucketByWeek(weeks, prs, reverted);
const baselineEntries = parseBaselineEntries(
  readFileSync(join(ROOT, 'eslint-rules/baseline.json'), 'utf8'),
);
const corrections = countCorrections(readFileSync(join(ROOT, 'docs/CORRECTIONS.md'), 'utf8'));

// pnpm audit exits non-zero when it finds anything, so read its JSON regardless of the exit code.
const audit = spawnSync('pnpm', ['audit', '--prod', '--json'], { cwd: ROOT, encoding: 'utf8' });

console.log(formatMetricsReport({ weeks: weekMetrics, baselineEntries, corrections }));
console.log(`\n${formatAuditLine(parseAuditCounts(audit.stdout))}`);
console.log(`\n${formatShadowAgreement(weeks, readFactoryPrs())}`);
