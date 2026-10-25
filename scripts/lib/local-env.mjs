// Local environment for `pnpm dev`, the test configs and every script that talks to the database.
//  - Loads .env.local at the repo root (values already in the environment win).
//  - Fills missing Supabase values from `supabase status -o env`. Never prints keys.
//  - Optionally picks free ports from 3000 / 4000 and points the web and API at each other.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import net from 'node:net';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export const NOT_RUNNING = "Local Supabase isn't running. Run pnpm db:start.";

/** Which `supabase status -o env` keys fill which variables, first match wins. */
const SUPABASE_SOURCES = {
  SUPABASE_URL: ['API_URL'],
  SUPABASE_ANON_KEY: ['ANON_KEY', 'PUBLISHABLE_KEY'],
  SUPABASE_SERVICE_ROLE_KEY: ['SERVICE_ROLE_KEY', 'SECRET_KEY'],
  NEXT_PUBLIC_SUPABASE_URL: ['API_URL'],
  NEXT_PUBLIC_SUPABASE_ANON_KEY: ['ANON_KEY', 'PUBLISHABLE_KEY'],
};

export class LocalEnvError extends Error {}

/** Sets variables from .env.local that aren't already set. */
export function loadEnvFile(env = process.env, file = join(ROOT, '.env.local')) {
  if (!existsSync(file)) return;
  for (const [key, value] of Object.entries(parseEnv(readFileSync(file, 'utf8')))) {
    if (env[key] === undefined || env[key] === '') env[key] = value;
  }
}

function readSupabaseStatus() {
  try {
    const out = execFileSync('supabase', ['status', '-o', 'env'], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 30_000,
    });
    return parseEnv(out);
  } catch {
    return undefined;
  }
}

/** Fills every missing Supabase variable; explicit values always win. */
export function fillSupabase(env = process.env, readStatus = readSupabaseStatus) {
  const missing = Object.keys(SUPABASE_SOURCES).filter((key) => !env[key]);
  if (missing.length === 0) return;
  const status = readStatus();
  if (!status?.API_URL) throw new LocalEnvError(NOT_RUNNING);
  for (const key of missing) {
    const value = SUPABASE_SOURCES[key].map((source) => status[source]).find(Boolean);
    if (!value) throw new LocalEnvError(NOT_RUNNING);
    env[key] = value;
  }
}

function isFree(port, host) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', (error) => resolve(error.code === 'EAFNOSUPPORT'));
    server.listen({ port, host, exclusive: true }, () => server.close(() => resolve(true)));
  });
}

/** The first port from `start` that is free on both IPv4 and IPv6, skipping `taken`. */
export async function findFreePort(start, taken = []) {
  for (let port = start; port < start + 100; port++) {
    if (taken.includes(port)) continue;
    if ((await isFree(port, '0.0.0.0')) && (await isFree(port, '::'))) return port;
  }
  throw new LocalEnvError(`No free port from ${start} to ${start + 99}.`);
}

/** Picks WEB_PORT / API_PORT (unless set) and sets NEXT_PUBLIC_API_URL and WEB_ORIGINS to match. */
export async function pickPorts(env = process.env) {
  const webPort = env.WEB_PORT ? Number(env.WEB_PORT) : await findFreePort(3000);
  const apiPort = env.API_PORT ? Number(env.API_PORT) : await findFreePort(4000, [webPort]);
  env.WEB_PORT = String(webPort);
  env.API_PORT = String(apiPort);
  env.NEXT_PUBLIC_API_URL = `http://localhost:${apiPort}`;
  env.WEB_ORIGINS = `http://localhost:${webPort}`;
  return { webPort, apiPort };
}

/**
 * Prepares `process.env` (so child processes and test workers inherit it).
 * Exits with the error message instead of throwing when `exitOnError` is set.
 */
export async function loadLocalEnv({ ports = false, exitOnError = true } = {}) {
  try {
    loadEnvFile();
    fillSupabase();
    return ports ? await pickPorts() : undefined;
  } catch (error) {
    if (exitOnError && error instanceof LocalEnvError) {
      console.error(error.message);
      process.exit(1);
    }
    throw error;
  }
}
