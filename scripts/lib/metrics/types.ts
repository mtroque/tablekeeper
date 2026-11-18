export type MergedPr = {
  number: number;
  title: string;
  headRefName: string;
  mergedAt: string;
  mergeCommitSha: string | null;
  labels: string[];
  /** Number of review rounds if W11 comments/reviews exist; null otherwise. */
  reviewRounds: number | null;
  /** Whether the first push's Checks run passed; null if unknown. */
  firstPushPassed: boolean | null;
};

export type GitCommit = {
  sha: string;
  subject: string;
  body: string;
};

export type WeekMetrics = {
  week: string;
  merged: number;
  factoryMerged: number;
  reverts: number;
  revertRate: number | null;
  ciFirstPassRate: number | null;
  factoryRuns: number | null;
  factoryFinished: number | null;
  needsHumanRate: number | null;
  avgReviewRounds: number | null;
};

export type PatternCount = {
  pattern: string;
  count: number;
  hardenCandidate: boolean;
};

export type BaselineEntry = {
  ruleId: string;
  file: string;
  count: number;
};
