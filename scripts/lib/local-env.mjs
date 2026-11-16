// Local environment for `pnpm dev`, the test configs and every script that talks to the database.
//  - Loads .env.local at the repo root (values already in the environment win).
//  - Fills missing local database and test-auth defaults. Never prints secrets.
//  - Optionally picks free ports from 3000 / 4000 and points the web and API at each other.
import { existsSync, readFileSync } from 'node:fs';
import net from 'node:net';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export const NOT_RUNNING = "Local Postgres isn't running. Run pnpm db:start.";
export const LOCAL_DATABASE_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/tablekeeper';
export const LOCAL_AUTH_URL = 'http://127.0.0.1:9/auth';
export const LOCAL_AUTH_TEST_SECRET = 'tablekeeper-local-test-secret';

const LOCAL_DEFAULTS = {
  DATABASE_URL: LOCAL_DATABASE_URL,
  NEON_AUTH_BASE_URL: LOCAL_AUTH_URL,
  NEXT_PUBLIC_NEON_AUTH_URL: LOCAL_AUTH_URL,
  AUTH_TEST_SECRET: LOCAL_AUTH_TEST_SECRET,
};

export class LocalEnvError extends Error {}

/** Sets variables from .env.local that aren't already set. */
export function loadEnvFile(env = process.env, file = join(ROOT, '.env.local')) {
  if (!existsSync(file)) return;
  for (const [key, value] of Object.entries(parseEnv(readFileSync(file, 'utf8')))) {
    if (env[key] === undefined || env[key] === '') env[key] = value;
  }
}

/** Fills missing local defaults; explicit values always win. */
export function fillLocalDefaults(env = process.env) {
  for (const [key, value] of Object.entries(LOCAL_DEFAULTS)) {
    if (!env[key]) env[key] = value;
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
    fillLocalDefaults();
    return ports ? await pickPorts() : undefined;
  } catch (error) {
    if (exitOnError && error instanceof LocalEnvError) {
      console.error(error.message);
      process.exit(1);
    }
    throw error;
  }
}
