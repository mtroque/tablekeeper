const SHELL_KEYS = ['command', 'CommandLine', 'commandLine', 'cmd'];
const WRITE_TOOL_RE = /write|edit|create|replace/i;

function clip(text: string, max: number): string {
  const oneLine = text.replaceAll(/\s+/g, ' ').trim();
  return oneLine.length > max ? `${oneLine.slice(0, max - 3)}...` : oneLine;
}

export { clip };

/** Head and tail of an error: the failing line is often at the end of long output. */
export function clipError(text: string, max = 2000): string {
  if (text.length <= max) return text;
  const half = Math.floor(max / 2);
  return `${text.slice(0, half)}\n...\n${text.slice(-half)}`;
}

/** The shell command of a tool call, if it runs one (Claude `Bash`, Antigravity `run_command`). */
export function shellCommand(input: Record<string, unknown>): string | null {
  for (const key of SHELL_KEYS) {
    const value = input[key];
    if (typeof value === 'string') return value;
  }
  return null;
}

/** String values under keys that name a file or path. */
export function pathValues(input: Record<string, unknown>): string[] {
  return Object.entries(input)
    .filter(([key, value]) => /path|file/i.test(key) && typeof value === 'string')
    .map(([, value]) => value as string);
}

export function isWriteTool(name: string): boolean {
  return WRITE_TOOL_RE.test(name);
}

export function relativeTo(path: string, cwd: string | null): string {
  if (cwd && path.startsWith(`${cwd}/`)) return path.slice(cwd.length + 1);
  return path;
}

const CORRECTION_ROW_RE = /^\|\s*\d{4}-\d{2}-\d{2}\s*\|\s*`?([a-z0-9-]+)`?\s*\|/gm;

/** Pattern tags of `docs/CORRECTIONS.md`-style rows a write adds, so the judge sees logged corrections. */
export function addedCorrectionTags(input: Record<string, unknown>): string[] {
  const text = ['new_string', 'content', 'CodeContent', 'ReplacementContent']
    .map((key) => input[key])
    .filter((value): value is string => typeof value === 'string')
    .join('\n');
  return [...text.matchAll(CORRECTION_ROW_RE)].map((m) => m[1] ?? '').filter(Boolean);
}

/** A short argument for the condensed trace: a command's first line, a relative path, a pattern. */
export function summarizeArg(
  name: string,
  input: Record<string, unknown>,
  cwd: string | null,
): string {
  const command = shellCommand(input);
  let arg: string;
  if (command !== null) {
    arg = clip(command.split('\n')[0] ?? '', 120);
  } else {
    const path = pathValues(input)[0];
    if (path !== undefined) {
      arg = relativeTo(path, cwd);
    } else {
      const first = Object.values(input).find((v): v is string => typeof v === 'string');
      arg = clip(first ?? '', 80);
    }
  }
  if (isWriteTool(name)) {
    const tags = addedCorrectionTags(input);
    if (tags.length > 0) arg += ` (+ corrections rows: ${tags.join(', ')})`;
  }
  return arg;
}
