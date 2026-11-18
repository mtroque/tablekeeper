// pnpm groom [--dry-run] [--baseline <path>]
// Opens up to 3 `groomer` + `agent-ready` issues for lint baseline entries that don't have one yet.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { z } from 'zod';

import { parseBaselineEntries } from './lib/metrics/baseline';
import type { BaselineEntry } from './lib/metrics/types';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const GROOM_CAP = 3;

export type PlannedIssue = {
  entry: BaselineEntry;
  title: string;
  body: string;
  labels: readonly string[];
};

export function groomIssueTitle(entry: Pick<BaselineEntry, 'ruleId' | 'file'>): string {
  return `chore(lint): clear ${entry.ruleId} in ${entry.file}`;
}

/**
 * Plans up to `cap` new issues for baseline entries that do not already match an open issue title.
 */
export function planGroomIssues(
  entries: readonly BaselineEntry[],
  openIssueTitles: readonly string[],
  cap = GROOM_CAP,
): PlannedIssue[] {
  const existing = new Set(openIssueTitles);
  const planned: PlannedIssue[] = [];
  for (const entry of entries) {
    if (planned.length >= cap) break;
    const title = groomIssueTitle(entry);
    if (existing.has(title)) continue;
    existing.add(title);
    planned.push({
      entry,
      title,
      body: [
        `Clear the ESLint baseline entry for \`${entry.ruleId}\` in \`${entry.file}\` (currently ${entry.count}).`,
        '',
        '## Acceptance criteria',
        `- [ ] \`${entry.ruleId}\` for \`${entry.file}\` is removed from \`eslint-rules/baseline.json\``,
        '- [ ] `pnpm lint` passes',
      ].join('\n'),
      labels: ['groomer', 'agent-ready'],
    });
  }
  return planned;
}

const GhIssueSchema = z.object({ number: z.number(), title: z.string() });

function runCli(): void {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes('--dry-run');
  const baselineIdx = argv.indexOf('--baseline');
  const baselinePath =
    baselineIdx !== -1 && argv[baselineIdx + 1]
      ? resolve(ROOT, argv[baselineIdx + 1] ?? '')
      : join(ROOT, 'eslint-rules/baseline.json');

  const entries = parseBaselineEntries(readFileSync(baselinePath, 'utf8'));
  if (entries.length === 0) {
    console.log('Baseline is empty; nothing to groom.');
    return;
  }

  const rawOpen = execFileSync(
    'gh',
    [
      'issue',
      'list',
      '--state',
      'open',
      '--label',
      'groomer',
      '--limit',
      '200',
      '--json',
      'number,title',
    ],
    { cwd: ROOT, encoding: 'utf8' },
  );
  const openTitles = z
    .array(GhIssueSchema)
    .parse(JSON.parse(rawOpen))
    .map((i) => i.title);
  const planned = planGroomIssues(entries, openTitles);

  if (planned.length === 0) {
    console.log('All baseline entries already have open issues.');
    return;
  }

  for (const item of planned) {
    if (dryRun) {
      console.log(`[dry-run] Would open: ${item.title}`);
      continue;
    }
    const url = execFileSync(
      'gh',
      [
        'issue',
        'create',
        '--title',
        item.title,
        '--body',
        item.body,
        '--label',
        item.labels.join(','),
      ],
      { cwd: ROOT, encoding: 'utf8' },
    ).trim();
    console.log(`Opened ${url}`);
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  runCli();
}
