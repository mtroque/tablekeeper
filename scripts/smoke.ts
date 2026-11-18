// pnpm smoke --api <url> --web <url>
// Read-only post-deploy checks against a running web app and API (W26, docs/DEPLOYMENT.md →
// Smoke test after each deploy). No sign-in, no writes. Prints one line per check and exits 1 if
// any check fails; `.github/workflows/smoke.yml` runs it after each production deploy.
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { z } from 'zod';

import { ErrorEnvelopeSchema } from '../packages/core/src/contracts/errors';
import { GamesResponseSchema } from '../packages/core/src/contracts/games';
import { HealthResponseSchema } from '../packages/core/src/contracts/health';

export type SmokeTarget = { apiUrl: string; webUrl: string };
export type SmokeResult = { name: string; ok: boolean; detail: string };
type Fetch = typeof fetch;
type Check = { name: string; run: (target: SmokeTarget, get: Fetch) => Promise<string> };

/** Thrown by a check with the reason it failed. */
class CheckFailed extends Error {}

const fail = (detail: string): never => {
  throw new CheckFailed(detail);
};

async function json(res: Response): Promise<unknown> {
  const text = await res.text();
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return fail(`expected JSON, got ${JSON.stringify(text.slice(0, 80))}`);
  }
}

function expectStatus(res: Response, status: number): void {
  if (res.status !== status) fail(`expected ${status}, got ${res.status}`);
}

/** The checks, in the order they run. Names appear in the output and in the failure issue. */
export const SMOKE_CHECKS: readonly Check[] = [
  {
    name: 'web',
    run: async ({ webUrl }, get) => {
      const res = await get(`${webUrl}/`);
      expectStatus(res, 200);
      const type = res.headers.get('content-type') ?? '';
      if (!type.includes('text/html')) fail(`expected an HTML page, got ${type || 'no type'}`);
      return `home page 200`;
    },
  },
  {
    name: 'health',
    run: async ({ apiUrl }, get) => {
      const res = await get(`${apiUrl}/health`);
      expectStatus(res, 200);
      if (!HealthResponseSchema.safeParse(await json(res)).success)
        fail('body is not { ok: true }');
      return '200 { ok: true }';
    },
  },
  {
    name: 'games',
    run: async ({ apiUrl }, get) => {
      const res = await get(`${apiUrl}/v1/games`);
      expectStatus(res, 200);
      const body = GamesResponseSchema.safeParse(await json(res));
      if (!body.success) return fail('body does not match GamesResponse');
      if (body.data.games.length === 0) fail('no games listed');
      return `200 with ${body.data.games.length} games`;
    },
  },
  {
    name: 'me-unauthenticated',
    run: async ({ apiUrl }, get) => {
      const res = await get(`${apiUrl}/v1/me`);
      expectStatus(res, 401);
      const body = ErrorEnvelopeSchema.safeParse(await json(res));
      if (body.data?.error.code !== 'UNAUTHENTICATED') fail('body is not an UNAUTHENTICATED error');
      return '401 UNAUTHENTICATED';
    },
  },
  {
    name: 'cors',
    run: async ({ apiUrl, webUrl }, get) => {
      const origin = new URL(webUrl).origin;
      const res = await get(`${apiUrl}/v1/me`, {
        method: 'OPTIONS',
        headers: {
          origin,
          'access-control-request-method': 'GET',
          'access-control-request-headers': 'authorization',
        },
      });
      if (res.status >= 400) fail(`preflight got ${res.status}`);
      const allowed = res.headers.get('access-control-allow-origin');
      if (allowed !== origin) fail(`allow-origin is ${allowed ?? 'missing'}, expected ${origin}`);
      const headers = (res.headers.get('access-control-allow-headers') ?? '').toLowerCase();
      if (!headers.split(/\s*,\s*/).includes('authorization')) {
        fail('authorization header not allowed');
      }
      return `allows ${origin} with authorization`;
    },
  },
];

function describeError(error: unknown): string {
  if (error instanceof CheckFailed) return error.message;
  if (error instanceof Error && error.name === 'TimeoutError') return 'timed out';
  if (error instanceof Error) {
    const cause = error.cause instanceof Error ? `: ${error.cause.message}` : '';
    return `request failed (${error.message}${cause})`;
  }
  return String(error);
}

/** Runs every check in order; never throws for a failing check. */
export async function runSmoke(
  target: SmokeTarget,
  opts: { fetch?: Fetch; timeoutMs?: number } = {},
): Promise<SmokeResult[]> {
  const baseFetch = opts.fetch ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 20_000;
  const get: Fetch = (input, init) =>
    baseFetch(input, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  const results: SmokeResult[] = [];
  for (const check of SMOKE_CHECKS) {
    try {
      results.push({ name: check.name, ok: true, detail: await check.run(target, get) });
    } catch (error) {
      results.push({ name: check.name, ok: false, detail: describeError(error) });
    }
  }
  return results;
}

/** One line per check, then a summary line. */
export function formatResults(target: SmokeTarget, results: readonly SmokeResult[]): string {
  const width = Math.max(...results.map((r) => r.name.length));
  const lines = results.map(
    (r) => `${r.ok ? 'ok  ' : 'FAIL'}  ${r.name.padEnd(width)}  ${r.detail}`,
  );
  const passed = results.filter((r) => r.ok).length;
  lines.push(
    `smoke: ${passed} of ${results.length} checks passed (api ${target.apiUrl}, web ${target.webUrl})`,
  );
  return lines.join('\n');
}

const HttpUrl = z.url({ protocol: /^https?$/ }).transform((url) => url.replace(/\/+$/, ''));

const ArgsSchema = z.object({ apiUrl: HttpUrl, webUrl: HttpUrl });

export const USAGE = 'Usage: pnpm smoke --api <api url> --web <web url>';

/** Parses `--api <url> --web <url>` (or `--api=<url>`). */
export function parseSmokeArgs(
  argv: readonly string[],
): { ok: true; value: SmokeTarget } | { ok: false; error: string } {
  const values: Record<string, string | undefined> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] ?? '';
    const match = /^--(api|web)(?:=(.*))?$/.exec(arg);
    if (!match?.[1]) return { ok: false, error: `Unknown argument ${arg}. ${USAGE}` };
    values[match[1]] = match[2] ?? argv[++i];
  }
  const parsed = ArgsSchema.safeParse({ apiUrl: values.api, webUrl: values.web });
  if (!parsed.success) {
    const fields = parsed.error.issues.map((issue) => issue.path.join('.')).join(', ');
    return { ok: false, error: `Missing or invalid ${fields}. ${USAGE}` };
  }
  return { ok: true, value: parsed.data };
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const args = parseSmokeArgs(process.argv.slice(2));
  if (!args.ok) {
    console.error(args.error);
    process.exit(2);
  }
  const results = await runSmoke(args.value);
  console.log(formatResults(args.value, results));
  if (results.some((r) => !r.ok)) process.exit(1);
}
