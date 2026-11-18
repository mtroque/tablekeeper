// Pure parts of `pnpm verify` (scripts/verify.ts): which steps run, and which lines of a failed
// step's log an agent needs to see (docs/CONVENTIONS.md → Commands for agents).

export type VerifyOptions = { full: boolean; keepGoing: boolean };
export type VerifyStep = { name: string; command: string[] };

const BASE_STEPS = ['typecheck', 'lint', 'lint:commits', 'check:repo', 'test:unit'];
const FULL_STEPS = ['typecheck', 'lint', 'lint:commits', 'check:repo', 'test', 'test:e2e'];

export const USAGE = 'Usage: pnpm verify [--full] [--keep-going]';

export function parseVerifyArgs(args: readonly string[]): VerifyOptions {
  const options: VerifyOptions = { full: false, keepGoing: false };
  for (const arg of args) {
    if (arg === '--full') options.full = true;
    else if (arg === '--keep-going') options.keepGoing = true;
    else throw new Error(`Unknown argument ${arg}. ${USAGE}`);
  }
  return options;
}

/** The checks from AGENTS.md → Definition of done, item 1 (`--full`), or the fast subset. */
export function verifySteps(options: VerifyOptions): VerifyStep[] {
  // `pnpm test` already runs the unit projects, so --full doesn't run them twice.
  return (options.full ? FULL_STEPS : BASE_STEPS).map((name) => ({
    name,
    command: ['pnpm', '-s', name],
  }));
}

const ANSI = /\u001b\[[0-9;?]*[A-Za-z]/g;
const ERROR_LINE =
  /(\berror\b|\bfail(ed|ure)?\b|✖|×|❯ .*\.(test|spec)\.|AssertionError|TS\d{4}|exited with code [1-9])/i;
const NOISE = /^\s*(\$ |\[ELIFECYCLE\]|RUN |Start at|Duration|└─|│|⣾|⣽|⣻|⢿|⡿|⣟|⣯|⣷)/;

/**
 * The lines of a failed step worth reading: error lines first (in order, without repeats), then
 * the end of the log, up to `max` lines in total.
 */
export function failureTail(log: string, max = 40): string[] {
  const lines = log
    .replace(ANSI, '')
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim() !== '' && !NOISE.test(line));
  const picked: string[] = [];
  const seen = new Set<string>();
  const take = (line: string) => {
    if (picked.length >= max || seen.has(line)) return;
    seen.add(line);
    picked.push(line);
  };
  for (const line of lines) if (ERROR_LINE.test(line)) take(line);
  const rest = lines.filter((line) => !seen.has(line));
  for (const line of rest.slice(Math.max(0, rest.length - (max - picked.length)))) take(line);
  return picked;
}

export function formatDuration(ms: number): string {
  return ms < 60_000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms / 1000)}s`;
}

/** Files ESLint should fix: existing JS and TS sources, without duplicates. */
export function lintableFiles(paths: readonly string[]): string[] {
  return [...new Set(paths)].filter(
    (path) => /\.(?:[cm]?[jt]sx?)$/.test(path) && !path.endsWith('.d.mts'),
  );
}
