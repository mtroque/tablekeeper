import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { parseAntigravityTranscript } from './antigravity';
import { parseClaudeTranscript } from './claude';
import type { Session } from './types';

/** Claude Code's project folder name for a path: every non-alphanumeric character becomes `-`. */
export function claudeSlug(path: string): string {
  return path.replaceAll(/[^a-zA-Z0-9]/g, '-');
}

/** Session files (`*.jsonl`) for a repo and its worktrees under `~/.claude/projects/`. */
export function claudeSessionFiles(projectsRoot: string, repoPath: string): string[] {
  if (!existsSync(projectsRoot)) return [];
  const slug = claudeSlug(repoPath);
  return readdirSync(projectsRoot)
    .filter((dir) => dir === slug || dir.startsWith(`${slug}-`))
    .flatMap((dir) => {
      const full = join(projectsRoot, dir);
      return readdirSync(full)
        .filter((f) => f.endsWith('.jsonl'))
        .map((f) => join(full, f));
    });
}

/** Antigravity `transcript_full.jsonl` files under each brain folder, with their conversation ids. */
export function antigravityFiles(brainRoots: readonly string[]): { id: string; path: string }[] {
  return brainRoots.flatMap((root) => {
    if (!existsSync(root)) return [];
    return readdirSync(root)
      .map((id) => ({
        id,
        path: join(root, id, '.system_generated', 'logs', 'transcript_full.jsonl'),
      }))
      .filter((f) => existsSync(f.path));
  });
}

export type DateRange = { since: Date; until: Date };

/** `--since` and `--until` as an inclusive UTC day range. */
export function parseRange(since: string, until: string): DateRange {
  const s = new Date(`${since}T00:00:00Z`);
  const u = new Date(`${until}T23:59:59.999Z`);
  if (Number.isNaN(s.getTime()) || Number.isNaN(u.getTime()) || s > u) {
    throw new Error(`Invalid date range ${since}..${until} (use YYYY-MM-DD).`);
  }
  return { since: s, until: u };
}

/**
 * The last full ISO week (Monday to Sunday) before `now`, as YYYY-MM-DD days. The default grading
 * window: the weekly report is titled with this week, so its days must all fall in it.
 */
export function lastFullWeek(now: Date): { since: string; until: string } {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const weekday = new Date(today).getUTCDay() || 7;
  const sunday = today - weekday * 86_400_000;
  const monday = sunday - 6 * 86_400_000;
  const day = (ms: number): string => new Date(ms).toISOString().slice(0, 10);
  return { since: day(monday), until: day(sunday) };
}

export function inRange(session: Session, range: DateRange): boolean {
  if (session.startedAt === null) return false;
  const start = new Date(session.startedAt);
  return start >= range.since && start <= range.until;
}

function modifiedSince(path: string, range: DateRange): boolean {
  return statSync(path).mtime >= range.since;
}

/** Reads local Claude Code and Antigravity sessions for `repoPath` that started in `range`. */
export function readLocalSessions(opts: {
  projectsRoot: string;
  brainRoots: readonly string[];
  repoPath: string;
  range: DateRange;
}): Session[] {
  const sessions: Session[] = [];
  for (const file of claudeSessionFiles(opts.projectsRoot, opts.repoPath)) {
    if (!modifiedSince(file, opts.range)) continue;
    const id =
      file
        .split('/')
        .pop()
        ?.replace(/\.jsonl$/, '') ?? 'unknown';
    sessions.push(parseClaudeTranscript(readFileSync(file, 'utf8'), id));
  }
  for (const { id, path } of antigravityFiles(opts.brainRoots)) {
    if (!modifiedSince(path, opts.range)) continue;
    const text = readFileSync(path, 'utf8');
    if (!text.includes(opts.repoPath)) continue;
    sessions.push(parseAntigravityTranscript(text, id));
  }
  return dedupe(sessions.filter((s) => inRange(s, opts.range)));
}

/** Reads every Claude session file in a folder (a decrypted factory session artifact). */
export function readSessionDir(dir: string, range: DateRange): Session[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.jsonl'))
    .map((f) =>
      parseClaudeTranscript(readFileSync(join(dir, f), 'utf8'), f.replace(/\.jsonl$/, '')),
    )
    .filter((s) => inRange(s, range));
}

export function dedupe(sessions: readonly Session[]): Session[] {
  const byId = new Map<string, Session>();
  for (const s of sessions) {
    const existing = byId.get(s.id);
    if (!existing || s.events.length > existing.events.length) byId.set(s.id, s);
  }
  return [...byId.values()].sort((a, b) => (a.startedAt ?? '').localeCompare(b.startedAt ?? ''));
}
