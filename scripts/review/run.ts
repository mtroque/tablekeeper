// PR review and fix-round driver invoked by .github/workflows/review.yml.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { z } from 'zod';

import { loadFactoryConfig } from '../factory/config';
import { claudeProjectDir, decryptSessionDir, encryptSessionDir } from '../factory/session';
import { markCheckoutTrusted } from '../factory/trust';

import {
  countReviewRounds,
  hasBlockingFindings,
  ReviewFindingsSchema,
  shouldSkipReviewForCommit,
  type PrReviewRecord,
  type ReviewFindings,
} from './findings';
import { extractSessionIdFromPrBody, parseDiffLines, postReviewWithFallback } from './post';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');

const GhPrViewSchema = z.object({
  number: z.number(),
  body: z.string(),
  headRefName: z.string(),
  headRefOid: z.string(),
  labels: z.array(z.object({ name: z.string() })),
  reviews: z.array(
    z.object({
      commit: z.object({ oid: z.string() }).nullable().optional(),
      body: z.string(),
      author: z.object({ login: z.string() }).nullable(),
    }),
  ),
});

function runReviewer(
  prNumber: number,
  model: string,
  effort: string,
  maxTurns: number,
  timeoutMinutes: number,
): ReviewFindings | null {
  const outPath = join(ROOT, '.scratch', `review-${prNumber}`, 'findings.json');
  mkdirSync(dirname(outPath), { recursive: true });
  markCheckoutTrusted(ROOT);

  for (let attempt = 0; attempt < 2; attempt++) {
    const prompt =
      attempt === 0
        ? `/review ${prNumber}`
        : `/review ${prNumber}\nPrevious findings.json was missing or invalid JSON; write valid JSON to .scratch/review-${prNumber}/findings.json.`;
    spawnSync(
      'claude',
      [
        '-p',
        prompt,
        '--model',
        model,
        '--effort',
        effort,
        '--max-turns',
        String(maxTurns),
        '--dangerously-skip-permissions',
      ],
      {
        cwd: ROOT,
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
        timeout: timeoutMinutes * 60_000,
      },
    );
    if (!existsSync(outPath)) continue;
    try {
      return ReviewFindingsSchema.parse(JSON.parse(readFileSync(outPath, 'utf8')));
    } catch {
      // Retry once on invalid output.
    }
  }
  return null;
}

function main(): void {
  const prNumber = Number.parseInt(process.env.PR_NUMBER ?? '', 10);
  if (!Number.isFinite(prNumber)) {
    console.error('PR_NUMBER env var is required.');
    process.exit(2);
  }

  const config = loadFactoryConfig(join(ROOT, '.github/factory/config.json'));
  const reviewCfg = config.review ?? {
    maxRounds: 2,
    blockingSeverity: 'should-fix' as const,
    labels: { review: 'review', needsHuman: 'needs-human' },
  };

  const prRaw = execFileSync(
    'gh',
    ['pr', 'view', String(prNumber), '--json', 'number,body,headRefName,headRefOid,labels,reviews'],
    { cwd: ROOT, encoding: 'utf8' },
  );
  const pr = GhPrViewSchema.parse(JSON.parse(prRaw));
  const labels = pr.labels.map((l) => l.name);
  const isFactoryPr = pr.headRefName.startsWith('factory/');
  if (!isFactoryPr && !labels.includes(reviewCfg.labels.review)) {
    console.log(
      `PR #${prNumber} is neither factory/* nor labeled ${reviewCfg.labels.review}; skipping.`,
    );
    return;
  }

  const reviews: PrReviewRecord[] = pr.reviews.map((r) => ({
    commitId: r.commit?.oid ?? null,
    body: r.body,
    authorLogin: r.author?.login ?? null,
  }));

  if (shouldSkipReviewForCommit(reviews, pr.headRefOid)) {
    console.log(`PR #${prNumber} commit ${pr.headRefOid} already reviewed; skipping.`);
    return;
  }

  const findings = runReviewer(
    prNumber,
    config.reviewer.model,
    config.reviewer.effort,
    config.reviewer.maxTurns,
    config.reviewer.timeoutMinutes,
  );

  if (!findings) {
    execFileSync(
      'gh',
      [
        'pr',
        'comment',
        String(prNumber),
        '--body',
        'Automated review produced invalid findings JSON after retry; flagging for human review.',
      ],
      { cwd: ROOT },
    );
    execFileSync(
      'gh',
      ['pr', 'edit', String(prNumber), '--add-label', reviewCfg.labels.needsHuman],
      { cwd: ROOT },
    );
    return;
  }

  const diff = execFileSync('gh', ['pr', 'diff', String(prNumber)], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  const repoFull = process.env.GITHUB_REPOSITORY ?? '';

  postReviewWithFallback(
    (payload) => {
      execFileSync(
        'gh',
        ['api', `repos/${repoFull}/pulls/${prNumber}/reviews`, '--method', 'POST', '--input', '-'],
        {
          cwd: ROOT,
          input: JSON.stringify({
            commit_id: pr.headRefOid,
            event: 'COMMENT',
            body: payload.body,
            comments: payload.comments,
          }),
        },
      );
    },
    findings,
    parseDiffLines(diff),
  );

  if (!hasBlockingFindings(findings.findings, reviewCfg.blockingSeverity)) {
    console.log(`PR #${prNumber}: no blocking findings.`);
    return;
  }

  if (!pr.headRefName.startsWith('factory/')) {
    console.log(`PR #${prNumber}: not a factory branch; skipping fix round.`);
    return;
  }

  const sessionId = extractSessionIdFromPrBody(pr.body);
  if (!sessionId) {
    console.log(`PR #${prNumber}: no session id in PR body; skipping fix round.`);
    return;
  }

  const roundsAfterThis = countReviewRounds(reviews) + 1;
  if (roundsAfterThis > reviewCfg.maxRounds) {
    execFileSync(
      'gh',
      ['pr', 'edit', String(prNumber), '--add-label', reviewCfg.labels.needsHuman],
      { cwd: ROOT },
    );
    console.log(
      `PR #${prNumber}: maxRounds (${reviewCfg.maxRounds}) reached; labeled needs-human.`,
    );
    return;
  }

  const sessionKey = process.env.FACTORY_SESSION_KEY ?? '';
  if (!sessionKey) {
    console.log('FACTORY_SESSION_KEY unset; cannot restore builder session.');
    return;
  }

  const encFile = join(ROOT, '.scratch', `session-${sessionId}.tar.gz.enc`);
  if (!existsSync(encFile)) {
    mkdirSync(dirname(encFile), { recursive: true });
    execFileSync('gh', ['run', 'download', '-n', `session-${sessionId}`, '-D', dirname(encFile)], {
      cwd: ROOT,
    });
  }
  const sessionDir = claudeProjectDir(ROOT);
  decryptSessionDir(encFile, sessionDir, sessionKey);

  const resumePrompt = [
    `Review round ${roundsAfterThis} posted blocking findings on PR #${prNumber}.`,
    'Fix or dispute each finding, log any fixed findings as `review` rows in the spec `## Corrections`, run the checks your fix touches, commit and push.',
    'Reply on each review thread with `fixed in <sha>` or `disputed: <reason>`.',
  ].join('\n');

  spawnSync(
    'claude',
    [
      '--resume',
      sessionId,
      '-p',
      resumePrompt,
      '--model',
      config.builder.model,
      '--effort',
      config.builder.effort,
      '--max-turns',
      String(config.builder.maxTurns),
      '--dangerously-skip-permissions',
    ],
    {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      timeout: config.builder.timeoutMinutes * 60_000,
    },
  );

  encryptSessionDir(sessionDir, encFile, sessionKey);
}

main();
