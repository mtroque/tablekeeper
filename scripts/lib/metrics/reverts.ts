import type { GitCommit, MergedPr, WeekMetrics } from './types';

/** Returns the ISO-8601 week string (`YYYY-Www`) in UTC for a date or ISO timestamp. */
export function isoWeek(input: Date | string): string {
  const date = typeof input === 'string' ? new Date(input) : new Date(input.getTime());
  const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((utc.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${utc.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** Returns the last `n` ISO weeks ending with `now`'s week, newest first. */
export function lastNWeeks(n: number, now = new Date()): string[] {
  const weeks: string[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getTime() - i * 7 * 86_400_000);
    const w = isoWeek(d);
    if (!weeks.includes(w)) weeks.push(w);
  }
  return weeks;
}

const REVERT_PR_TITLE_RE = /^Revert\s+"(.+?)"(?:\s+\(#(\d+)\))?$/;
const REVERT_COMMIT_RE = /This reverts commit ([0-9a-f]{7,40})\./g;

/**
 * Finds which merged PRs were later reverted, either by a `This reverts commit <sha>.` commit
 * or by a `Revert "..."` PR matching an earlier PR's title or `#number`.
 * Ignores unrelated commits that merely mention the word "revert".
 */
export function extractRevertedPrs(
  commits: readonly GitCommit[],
  prs: readonly MergedPr[],
): Set<number> {
  const reverted = new Set<number>();
  const prBySha = new Map<string, number>();
  const prByTitle = new Map<string, number[]>();

  for (const pr of prs) {
    if (pr.mergeCommitSha) {
      prBySha.set(pr.mergeCommitSha, pr.number);
      prBySha.set(pr.mergeCommitSha.slice(0, 7), pr.number);
    }
    const list = prByTitle.get(pr.title) ?? [];
    list.push(pr.number);
    prByTitle.set(pr.title, list);
  }

  for (const commit of commits) {
    for (const match of commit.body.matchAll(REVERT_COMMIT_RE)) {
      const sha = match[1];
      if (!sha) continue;
      const prNum = prBySha.get(sha) ?? prBySha.get(sha.slice(0, 7));
      if (prNum !== undefined) reverted.add(prNum);
    }
  }

  for (const pr of prs) {
    const match = REVERT_PR_TITLE_RE.exec(pr.title);
    if (!match) continue;
    const [, originalTitle, refNum] = match;
    if (refNum) {
      const num = Number.parseInt(refNum, 10);
      if (prs.some((p) => p.number === num)) {
        reverted.add(num);
        continue;
      }
    }
    if (originalTitle) {
      for (const num of prByTitle.get(originalTitle) ?? []) {
        if (num !== pr.number) reverted.add(num);
      }
    }
  }

  return reverted;
}

export function bucketByWeek(
  weeks: readonly string[],
  prs: readonly MergedPr[],
  revertedPrs: ReadonlySet<number>,
): WeekMetrics[] {
  return weeks.map((week) => {
    const inWeek = prs.filter((pr) => isoWeek(pr.mergedAt) === week);
    const merged = inWeek.length;
    const factoryPrs = inWeek.filter((pr) => pr.headRefName.startsWith('factory/'));
    const factoryMerged = factoryPrs.length;
    const reverts = inWeek.filter((pr) => revertedPrs.has(pr.number)).length;
    const revertRate = merged > 0 ? reverts / merged : null;

    const withCi = inWeek.filter((pr) => pr.firstPushPassed !== null);
    const ciFirstPassRate =
      withCi.length > 0
        ? withCi.filter((pr) => pr.firstPushPassed === true).length / withCi.length
        : null;

    const needsHuman = factoryPrs.filter((pr) => pr.labels.includes('needs-human')).length;
    const withRounds = inWeek.filter((pr) => pr.reviewRounds !== null);
    const avgReviewRounds =
      withRounds.length > 0
        ? withRounds.reduce((sum, pr) => sum + (pr.reviewRounds ?? 0), 0) / withRounds.length
        : null;

    return {
      week,
      merged,
      factoryMerged,
      reverts,
      revertRate,
      ciFirstPassRate,
      factoryRuns: factoryMerged > 0 ? factoryMerged : null,
      factoryFinished: factoryMerged > 0 ? factoryMerged : null,
      needsHumanRate: factoryMerged > 0 ? needsHuman / factoryMerged : null,
      avgReviewRounds,
    };
  });
}
