// GraphQL reader for the "Factory" GitHub Project + `pnpm queue:sync`.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { z } from 'zod';

import { parseRoadmapStatuses } from './queue';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');

const ProjectItemsSchema = z.object({
  data: z.object({
    repository: z
      .object({
        owner: z.object({
          projectV2: z
            .object({
              id: z.string(),
              items: z.object({
                nodes: z.array(
                  z.object({
                    id: z.string(),
                    rank: z.object({ number: z.number().nullable() }).nullable().optional(),
                    content: z
                      .object({
                        number: z.number().optional(),
                      })
                      .nullable(),
                  }),
                ),
              }),
            })
            .nullable(),
        }),
      })
      .nullable(),
  }),
});

export type ProjectOrderResult = {
  projectId: string | null;
  order: number[];
  /** Read with `FACTORY_PROJECT_TOKEN` rather than the App token. */
  usedProjectToken?: boolean;
};

type GraphqlExecutor = (query: string, token?: string) => string;

function defaultGraphqlExecutor(
  owner: string,
  repo: string,
  projectNumber: number,
): GraphqlExecutor {
  return (query, token) =>
    execFileSync(
      'gh',
      [
        'api',
        'graphql',
        '-f',
        `query=${query}`,
        '-f',
        `owner=${owner}`,
        '-f',
        `repo=${repo}`,
        '-F',
        `number=${projectNumber}`,
      ],
      {
        cwd: ROOT,
        encoding: 'utf8',
        // gh's own error goes into the thrown error, not straight to the log.
        stdio: ['ignore', 'pipe', 'pipe'],
        env: token ? { ...process.env, GH_TOKEN: token } : process.env,
      },
    );
}

function parseProjectOrderResponse(raw: string): { projectId: string | null; order: number[] } {
  const parsed = ProjectItemsSchema.parse(JSON.parse(raw));
  const project = parsed.data.repository?.owner.projectV2;
  if (!project) return { projectId: null, order: [] };

  const items = project.items.nodes
    .filter((n) => typeof n.content?.number === 'number')
    .map((n, index) => ({
      number: n.content?.number ?? 0,
      index,
      rank: n.rank?.number ?? null,
    }));

  const hasRanks = items.some((i) => i.rank !== null);
  if (hasRanks) {
    items.sort(
      (a, b) =>
        (a.rank ?? Number.MAX_SAFE_INTEGER) - (b.rank ?? Number.MAX_SAFE_INTEGER) ||
        a.index - b.index,
    );
  }

  return { projectId: project.id, order: items.map((i) => i.number) };
}

/**
 * Reads the issue numbers in the "Factory" GitHub Project in manual drag order (`POSITION`).
 * With `projectToken` (`FACTORY_PROJECT_TOKEN`) set, it reads with that first: a GitHub App
 * can't read a Project owned by a personal account, so trying the App token first only logged
 * a misleading error on every run. The App token is the fallback.
 */
export function readFactoryProjectOrder(
  owner: string,
  repo: string,
  projectNumber = 1,
  opts?: {
    primaryToken?: string;
    projectToken?: string;
    execGraphql?: GraphqlExecutor;
  },
): ProjectOrderResult {
  const query = `
    query($owner: String!, $repo: String!, $number: Int!) {
      repository(owner: $owner, name: $repo) {
        owner {
          ... on User {
            projectV2(number: $number) {
              id
              items(first: 100) {
                nodes {
                  id
                  rank: fieldValueByName(name: "Rank") {
                    ... on ProjectV2ItemFieldNumberValue { number }
                  }
                  content {
                    ... on Issue { number }
                  }
                }
              }
            }
          }
        }
      }
    }
  `;

  const execGraphql = opts?.execGraphql ?? defaultGraphqlExecutor(owner, repo, projectNumber);
  const primaryToken = opts?.primaryToken ?? process.env.GH_TOKEN;
  const projectToken = opts?.projectToken ?? process.env.FACTORY_PROJECT_TOKEN;

  const attempts: { token: string | undefined; label: string; isProjectToken: boolean }[] = [
    ...(projectToken
      ? [{ token: projectToken, label: 'FACTORY_PROJECT_TOKEN', isProjectToken: true }]
      : []),
    { token: primaryToken, label: 'the App token', isProjectToken: false },
  ];
  const errors: string[] = [];
  for (const attempt of attempts) {
    try {
      const result = parseProjectOrderResponse(execGraphql(query, attempt.token));
      if (result.projectId !== null) {
        return attempt.isProjectToken ? { ...result, usedProjectToken: true } : result;
      }
      errors.push(`${attempt.label}: Project not found`);
    } catch (error) {
      errors.push(`${attempt.label}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const hint = projectToken ? '' : ' (FACTORY_PROJECT_TOKEN is not set)';
  if (errors.every((e) => e.endsWith('Project not found'))) return { projectId: null, order: [] };
  throw new Error(`Failed to read Factory Project #${projectNumber}${hint}: ${errors.join('; ')}`);
}

function findSpecPath(sliceId: string): string | null {
  const dir = join(ROOT, 'docs/slices');
  if (!existsSync(dir)) return null;
  const match = readdirSync(dir).find((f) => f.startsWith(`${sliceId}-`) && f.endsWith('.md'));
  return match ? `docs/slices/${match}` : null;
}

export function syncQueue(dryRun = false): void {
  const roadmap = parseRoadmapStatuses(readFileSync(join(ROOT, 'docs/ROADMAP.md'), 'utf8'));
  const rawIssues = execFileSync(
    'gh',
    ['issue', 'list', '--state', 'all', '--limit', '200', '--json', 'number,title,body'],
    { cwd: ROOT, encoding: 'utf8' },
  );
  const existing = z
    .array(z.object({ number: z.number(), title: z.string(), body: z.string() }))
    .parse(JSON.parse(rawIssues));

  for (const [sliceId, info] of roadmap.entries()) {
    if (info.status !== '⬜') continue;
    const alreadyExists = existing.some(
      (i) =>
        i.title.startsWith(`${sliceId}:`) ||
        i.title.startsWith(`${sliceId} `) ||
        i.body.includes(`docs/slices/${sliceId}-`),
    );
    if (alreadyExists) continue;

    const specPath = findSpecPath(sliceId);
    const title = `${sliceId}: build slice ${sliceId}`;
    const body = specPath
      ? `Build slice ${sliceId} per \`${specPath}\`.`
      : `Build slice ${sliceId} per \`docs/ROADMAP.md\`.`;

    if (dryRun) {
      console.log(`[dry-run] Would open issue: ${title}`);
      continue;
    }
    const url = execFileSync('gh', ['issue', 'create', '--title', title, '--body', body], {
      cwd: ROOT,
      encoding: 'utf8',
    }).trim();
    console.log(`Opened ${url}`);
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const argv = process.argv.slice(2);
  if (argv.includes('--sync')) {
    syncQueue(argv.includes('--dry-run'));
  }
}
