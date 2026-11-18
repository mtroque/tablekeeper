import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * Marks `checkoutPath` as trusted in `~/.claude.json` so `.claude/settings.json` allow/deny
 * rules apply in headless runs.
 */
export function markCheckoutTrusted(checkoutPath: string, home = homedir()): string {
  const configPath = join(home, '.claude.json');
  let data: Record<string, unknown> = {};
  if (existsSync(configPath)) {
    const parsed: unknown = JSON.parse(readFileSync(configPath, 'utf8'));
    if (typeof parsed === 'object' && parsed !== null) {
      data = parsed as Record<string, unknown>;
    }
  }
  const existingProjects =
    typeof data.projects === 'object' && data.projects !== null
      ? (data.projects as Record<string, unknown>)
      : {};
  const existingEntry =
    typeof existingProjects[checkoutPath] === 'object' && existingProjects[checkoutPath] !== null
      ? (existingProjects[checkoutPath] as Record<string, unknown>)
      : {};

  data.projects = {
    ...existingProjects,
    [checkoutPath]: {
      ...existingEntry,
      hasTrustDialogAccepted: true,
    },
  };

  mkdirSync(dirname(configPath), { recursive: true });
  writeFileSync(configPath, `${JSON.stringify(data, null, 2)}\n`);
  return configPath;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const checkoutPath = resolve(process.argv[2] ?? process.cwd());
  const written = markCheckoutTrusted(checkoutPath);
  console.log(`Marked ${checkoutPath} trusted in ${written}`);
}
