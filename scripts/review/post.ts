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

function readExecStream(value: unknown): string {
  if (value instanceof Buffer) return value.toString('utf8');
  return typeof value === 'string' ? value : '';
}

function formatExecError(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const extra = error as Error & { stderr?: unknown; stdout?: unknown };
  return `${error.message}\n${readExecStream(extra.stderr)}\n${readExecStream(extra.stdout)}`;
}

/**
 * Posts a review with inline comments, falling back to body-only findings when GitHub
 * rejects inline line resolution (HTTP 422 "Line could not be resolved").
 */
export function postReviewWithFallback(
  postFn: (payload: BuiltReviewPayload) => void,
  result: ReviewFindings,
  diffLines: ReadonlyMap<string, ReadonlySet<number>>,
): void {
  const payload = buildReviewPayload(result, diffLines);
  try {
    postFn(payload);
  } catch (error) {
    const details = formatExecError(error);
    if (
      payload.comments.length === 0 ||
      (!details.includes('422') && !details.includes('Line could not be resolved'))
    ) {
      throw error;
    }
    postFn(buildReviewPayload(result, new Map()));
  }
}
