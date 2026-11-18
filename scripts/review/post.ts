import { REVIEW_MARKER, type ReviewFinding, type ReviewFindings } from './findings';

export type InlineReviewComment = {
  path: string;
  line: number;
  body: string;
};

export type BuiltReviewPayload = {
  body: string;
  comments: InlineReviewComment[];
};

/**
 * Parses unified diff hunk headers into a map of `file -> Set<newLineNumber>`.
 */
export function parseDiffLines(diff: string): Map<string, Set<number>> {
  const map = new Map<string, Set<number>>();
  let currentFile: string | null = null;
  let newLine = 0;

  for (const line of diff.split(/\r?\n/)) {
    if (line.startsWith('+++ b/')) {
      currentFile = line.slice('+++ b/'.length).trim();
      if (!map.has(currentFile)) map.set(currentFile, new Set());
      continue;
    }
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line);
    if (hunk?.[1]) {
      newLine = Number.parseInt(hunk[1], 10);
      continue;
    }
    if (!currentFile) continue;
    if (line.startsWith('+') && !line.startsWith('+++')) {
      map.get(currentFile)?.add(newLine);
      newLine += 1;
    } else if (!line.startsWith('-') && !line.startsWith('\\')) {
      map.get(currentFile)?.add(newLine);
      newLine += 1;
    }
  }
  return map;
}

function formatFinding(f: ReviewFinding): string {
  return `**[${f.severity}]** ${f.summary}\n\nFailure scenario: ${f.failureScenario}`;
}

/**
 * Maps findings to inline PR review comments when their line is in the diff, and places
 * out-of-diff findings into the review summary body so the GitHub API call never fails.
 */
export function buildReviewPayload(
  result: ReviewFindings,
  diffLines: ReadonlyMap<string, ReadonlySet<number>>,
): BuiltReviewPayload {
  const comments: InlineReviewComment[] = [];
  const offDiff: ReviewFinding[] = [];

  for (const finding of result.findings) {
    const fileLines = diffLines.get(finding.file);
    if (fileLines?.has(finding.line)) {
      comments.push({
        path: finding.file,
        line: finding.line,
        body: formatFinding(finding),
      });
    } else {
      offDiff.push(finding);
    }
  }

  const lines = [
    REVIEW_MARKER,
    `### Verdict: \`${result.verdict.recommendation}\` (risk: \`${result.verdict.risk}\`, confidence: ${result.verdict.confidence.toFixed(2)})`,
    '',
    ...result.verdict.reasons.map((r) => `- ${r}`),
  ];

  if (offDiff.length > 0) {
    lines.push('', '### Findings outside diff lines', '');
    for (const f of offDiff) {
      lines.push(
        `- \`${f.file}:${f.line}\` **[${f.severity}]**: ${f.summary} (${f.failureScenario})`,
      );
    }
  }

  return { body: lines.join('\n'), comments };
}

export function extractSessionIdFromPrBody(body: string): string | null {
  const match = /^-\s*Session:\s*`?([a-zA-Z0-9-]+)`?/m.exec(body);
  const id = match?.[1]?.trim();
  return id && id !== '<session-id>' ? id : null;
}
