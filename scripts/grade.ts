// pnpm grade [--since YYYY-MM-DD] [--until YYYY-MM-DD] [--source local|factory] [--projects <dir>]
//            [--no-judge] [--issue]
// Grades agent session transcripts for silent failures (W16, docs/AUTOMATION.md → Grading):
// condenses each session, classifies failures by pattern, has a model judge a sample, and prints
// a report of proposed `trace` rows. Transcripts and condensed traces stay in .scratch/grade/.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { z } from 'zod';

import { decryptSessionDir } from './factory/session';
import { isoWeek } from './lib/metrics/reverts';
import { gradeSession } from './lib/traces/classify';
import {
  dedupe,
  parseRange,
  readLocalSessions,
  readSessionDir,
  type DateRange,
} from './lib/traces/collect';
import { condenseSession } from './lib/traces/condense';
import { loadGraderConfig, type GraderConfig } from './lib/traces/config';
import {
  buildJudgePrompt,
  correctionsIndex,
  JUDGE_JSON_SCHEMA,
  loadRubrics,
  parseJudgeOutput,
} from './lib/traces/judge';
import { formatReport, knownTagsFrom, shortId } from './lib/traces/report';
import { selectForJudging } from './lib/traces/select';
import type { GradedSession, JudgedSession, Session } from './lib/traces/types';
import { extractSessionIdFromPrBody } from './review/post';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const USAGE =
  'Usage: pnpm grade [--since YYYY-MM-DD] [--until YYYY-MM-DD] [--source local|factory] [--projects <dir>] [--no-judge] [--issue]';

function flag(argv: readonly string[], name: string): string | null {
  const idx = argv.indexOf(name);
  return idx === -1 ? null : (argv[idx + 1] ?? null);
}

function day(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function linkPrs(): Map<string, number> {
  const links = new Map<string, number>();
  try {
    const raw = execFileSync(
      'gh',
      ['pr', 'list', '--state', 'all', '--limit', '300', '--json', 'number,body'],
      { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    );
    const prs = z.array(z.object({ number: z.number(), body: z.string() })).parse(JSON.parse(raw));
    for (const pr of prs) {
      const id = extractSessionIdFromPrBody(pr.body);
      if (id) links.set(id, pr.number);
    }
  } catch {
    console.error('Could not list PRs with gh; sessions are not linked to PRs.');
  }
  return links;
}

function prFor(links: ReadonlyMap<string, number>, id: string): number | null {
  for (const [sessionId, pr] of links) {
    if (sessionId === id || (sessionId.length >= 8 && id.startsWith(sessionId))) return pr;
  }
  return null;
}

const ArtifactSchema = z.object({
  name: z.string(),
  created_at: z.string(),
  expired: z.boolean(),
  workflow_run: z.object({ id: z.number() }).nullable(),
});

/** Downloads and decrypts the factory's `session-<id>` artifacts created in the range. */
function readFactorySessions(range: DateRange, workDir: string): Session[] {
  const key = process.env.FACTORY_SESSION_KEY ?? '';
  if (!key) throw new Error('FACTORY_SESSION_KEY is required for --source factory.');
  const raw = execFileSync(
    'gh',
    [
      'api',
      '--paginate',
      'repos/{owner}/{repo}/actions/artifacts?per_page=100',
      '--jq',
      '.artifacts[] | {name, created_at, expired, workflow_run: (if .workflow_run then {id: .workflow_run.id} else null end)}',
    ],
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );
  const artifacts = raw
    .split('\n')
    .filter((l) => l.trim())
    .map((l) => ArtifactSchema.parse(JSON.parse(l)))
    .filter((a) => a.name.startsWith('session-') && !a.expired && a.workflow_run !== null)
    .filter((a) => {
      const created = new Date(a.created_at);
      return created >= range.since && created <= range.until;
    });

  const sessions: Session[] = [];
  for (const artifact of artifacts) {
    const id = artifact.name.slice('session-'.length);
    const downloadDir = join(workDir, 'artifacts', id);
    const sessionDir = join(workDir, 'sessions', id);
    try {
      execFileSync(
        'gh',
        [
          'run',
          'download',
          String(artifact.workflow_run?.id ?? ''),
          '-n',
          artifact.name,
          '-D',
          downloadDir,
        ],
        { cwd: ROOT, stdio: 'ignore' },
      );
      const enc = readdirSync(downloadDir).find((f) => f.endsWith('.enc'));
      if (!enc) throw new Error('no .enc file in artifact');
      decryptSessionDir(join(downloadDir, enc), sessionDir, key);
      // The artifact holds the whole project folder; keep only real sessions in range.
      sessions.push(...readSessionDir(sessionDir, range));
    } catch (error) {
      console.error(
        `Skipped ${artifact.name}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  return dedupe(sessions);
}

function judgeSessions(
  graded: readonly GradedSession[],
  config: GraderConfig,
  week: string,
  traceDir: string,
): { judged: JudgedSession[]; tokens: number } {
  const rubrics = loadRubrics(join(ROOT, '.agents/skills/grade/rubrics'));
  const logIndex = correctionsIndex(readFileSync(join(ROOT, 'docs/CORRECTIONS.md'), 'utf8'));
  const picks = selectForJudging(graded, { ...config, seed: week });
  const judged: JudgedSession[] = [];
  let tokens = 0;
  for (const pick of picks) {
    if (tokens >= config.tokenCap) {
      console.error(
        `Token cap ${config.tokenCap} reached; ${picks.length - judged.length} session(s) not judged.`,
      );
      break;
    }
    const trace = readFileSync(join(traceDir, `${pick.id}.txt`), 'utf8');
    const prompt = buildJudgePrompt(rubrics, trace, logIndex);
    // Run outside the repo so no project instructions load, with no tools and no saved session.
    const res = spawnSync(
      'claude',
      [
        '-p',
        '--model',
        config.model,
        '--effort',
        config.effort,
        '--tools',
        '',
        '--no-session-persistence',
        '--output-format',
        'json',
        '--json-schema',
        JSON.stringify(JUDGE_JSON_SCHEMA),
      ],
      {
        cwd: tmpdir(),
        input: prompt,
        encoding: 'utf8',
        maxBuffer: 16 * 1024 * 1024,
        timeout: config.timeoutMinutes * 60_000,
      },
    );
    if (res.error) {
      console.error(`Judge unavailable (${res.error.message}); skipping the judged sample.`);
      break;
    }
    const { results, tokens: used } = parseJudgeOutput(
      res.stdout,
      rubrics.map((r) => r.name),
    );
    tokens += used;
    if (results === null && used === 0) {
      // Nothing was spent: the CLI is signed out or failed before answering; don't retry per session.
      console.error(
        'Judge gave no answer and used no tokens (is claude signed in?); skipping the judged sample.',
      );
      break;
    }
    judged.push({ id: pick.id, reason: pick.reason, results, tokens: used });
  }
  return { judged, tokens };
}

function publishIssue(title: string, bodyFile: string): void {
  const raw = execFileSync(
    'gh',
    [
      'issue',
      'list',
      '--state',
      'all',
      '--search',
      `"${title}" in:title`,
      '--json',
      'number,title',
    ],
    { cwd: ROOT, encoding: 'utf8' },
  );
  const existing = z
    .array(z.object({ number: z.number(), title: z.string() }))
    .parse(JSON.parse(raw))
    .find((i) => i.title === title);
  if (existing) {
    execFileSync('gh', ['issue', 'edit', String(existing.number), '--body-file', bodyFile], {
      cwd: ROOT,
    });
    console.error(`Updated issue #${existing.number}.`);
  } else {
    execFileSync('gh', ['issue', 'create', '--title', title, '--body-file', bodyFile], {
      cwd: ROOT,
      stdio: 'inherit',
    });
  }
}

function main(): void {
  const argv = process.argv.slice(2);
  if (argv.includes('--help')) {
    console.log(USAGE);
    return;
  }
  const until = flag(argv, '--until') ?? day(new Date());
  const since =
    flag(argv, '--since') ??
    day(new Date(new Date(`${until}T00:00:00Z`).getTime() - 6 * 86_400_000));
  const source = flag(argv, '--source') ?? 'local';
  if (source !== 'local' && source !== 'factory') {
    console.error(USAGE);
    process.exit(2);
  }
  const range = parseRange(since, until);
  const week = isoWeek(range.until);
  // Only the default 7-day window owns the week's issue, which `pnpm metrics` reads; a custom
  // range gets its own dated title so it never overwrites the weekly report.
  const customRange = flag(argv, '--since') !== null || flag(argv, '--until') !== null;
  const title = customRange ? `Grading report ${since} to ${until}` : `Grading report ${week}`;
  const config = loadGraderConfig(join(ROOT, '.github/factory/config.json'));
  const workDir = join(ROOT, '.scratch', 'grade', `${source}-${since}_${until}`);
  rmSync(workDir, { recursive: true, force: true });
  const traceDir = join(workDir, 'traces');
  mkdirSync(traceDir, { recursive: true });

  const sessions =
    source === 'factory'
      ? readFactorySessions(range, workDir)
      : readLocalSessions({
          projectsRoot: flag(argv, '--projects') ?? join(homedir(), '.claude', 'projects'),
          brainRoots: [
            join(homedir(), '.gemini', 'antigravity-cli', 'brain'),
            join(homedir(), '.gemini', 'antigravity', 'brain'),
          ],
          repoPath: ROOT,
          range,
        });

  const links = linkPrs();
  const graded = sessions.map((s) => gradeSession(s, prFor(links, s.id)));
  for (const g of graded) {
    writeFileSync(join(traceDir, `${g.session.id}.txt`), condenseSession(g, config.maxTraceChars));
  }

  const { judged, tokens } =
    argv.includes('--no-judge') || graded.length === 0
      ? { judged: [], tokens: 0 }
      : judgeSessions(graded, config, week, traceDir);

  const report = formatReport({
    week,
    title,
    since,
    until,
    source,
    sessions: graded,
    judged,
    judgeTokens: tokens,
    knownTags: knownTagsFrom(readFileSync(join(ROOT, 'docs/CORRECTIONS.md'), 'utf8')),
    date: day(new Date()),
  });
  const reportFile = join(workDir, 'report.md');
  writeFileSync(reportFile, report);
  console.log(report);
  console.error(
    `Condensed traces: ${traceDir} (${graded.length} session(s): ${graded.map((g) => shortId(g.session.id)).join(', ') || 'none'}). Never commit them.`,
  );

  if (argv.includes('--issue')) publishIssue(title, reportFile);
  if (source === 'factory' && existsSync(join(workDir, 'artifacts'))) {
    rmSync(join(workDir, 'artifacts'), { recursive: true, force: true });
  }
}

main();
