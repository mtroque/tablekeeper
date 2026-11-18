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

/**
 * Reads the issue numbers in the "Factory" GitHub Project in manual drag order (`POSITION`),
 * falling back to a numeric `Rank` field if any items carry one.
 */
export function readFactoryProjectOrder(
  owner: string,
  repo: string,
  projectNumber = 1,
): {
  projectId: string | null;
  order: number[];
} {
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

  try {
    const raw = execFileSync(
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
      { cwd: ROOT, encoding: 'utf8' },
    );
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
  } catch {
    return { projectId: null, order: [] };
  }
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
