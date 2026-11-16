const GAME_IDS = ['patchwork', 'azul', 'harmonies', 'dorfromantik'] as const;

/** Shared hub files where a slice may add lines without owning the file (AGENTS.md → Parallel sessions). */
export const ADDITIVE_WIRING_FILES = new Set([
  'packages/core/src/index.ts',
  'packages/cv/src/index.ts',
  'apps/api/src/app.ts',
  'packages/core/src/games/registry.ts',
  'apps/web/src/games/registry.ts',
  'apps/web/src/games/detectors.ts',
  'vitest.config.ts',
  'playwright.config.ts',
]);

/**
 * Shared docs every slice updates in its own finish commit (AGENTS.md → Parallel sessions →
 * Shared docs): the roadmap row may be edited, decisions and corrections only appended to,
 * unless a spec owns the file (e.g. `/harden` setting correction statuses).
 */
export const SHARED_DOC_FILES = new Map<string, 'edit' | 'append'>([
  ['docs/ROADMAP.md', 'edit'],
  ['docs/DECISIONS.md', 'append'],
  ['docs/CORRECTIONS.md', 'append'],
]);

export type ChangedFile = {
  path: string;
  /** Number of removed lines in `git diff -U0` (0 when only adding lines). */
  removedLines: number;
};

/** Expands brace expressions like `{a,b}/c` into `['a/c', 'b/c']`. */
export function expandBraces(pattern: string): string[] {
  const match = /\{([^{}]+)\}/.exec(pattern);
  if (!match) return [pattern];
  const [full, inner = ''] = match;
  const prefix = pattern.slice(0, match.index);
  const suffix = pattern.slice(match.index + full.length);
  return inner
    .split(',')
    .map((part) => part.trim())
    .flatMap((part) => expandBraces(`${prefix}${part}${suffix}`));
}

/** Converts a repo-relative path, folder prefix (`dir/`), or glob (`*`, `**`) into a RegExp. */
export function patternToRegExp(rawPattern: string): RegExp {
  const normalized = rawPattern.replaceAll('\\', '/').trim().replace(/^\.\//, '');
  // A directory path without wildcards matches everything inside that directory.
  if (normalized.endsWith('/')) {
    const escaped = normalized.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`^${escaped}.+$`);
  }
  let regex = '^';
  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i] ?? '';
    if (ch === '*') {
      if (normalized[i + 1] === '*') {
        if (normalized[i + 2] === '/') {
          regex += '(?:.+/)?';
          i += 2;
        } else {
          regex += '.*';
          i += 1;
        }
      } else {
        regex += '[^/]*';
      }
    } else if ('.+^${}()|[]\\'.includes(ch)) {
      regex += `\\${ch}`;
    } else {
      regex += ch;
    }
  }
  // Also match files inside a directory when a path without trailing slash names a folder.
  regex += '(?:/.*)?$';
  return new RegExp(regex);
}

/** Extracts the `## Owns` section body from a slice spec markdown document. */
export function extractOwnsSection(markdown: string): string {
  const lines = markdown.split(/\r?\n/);
  const start = lines.findIndex((line) => /^##\s+Owns\b/.test(line.trim()));
  if (start === -1) return '';
  const body: string[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i] ?? '';
    if (/^##\s+/.test(line.trim())) break;
    body.push(line);
  }
  return body.join('\n');
}

/**
 * Parses a slice spec's `## Owns` section into repo-relative path/glob patterns.
 * Recognizes backticked paths/globs and the standard shorthand "The `<gameId>` game folders".
 */
export function parseSpecOwns(specPath: string, specContent: string): string[] {
  const section = extractOwnsSection(specContent);
  const patterns = new Set<string>([specPath.replaceAll('\\', '/')]);

  // Standard game-slice shorthand (AGENTS.md → Parallel sessions).
  for (const gameId of GAME_IDS) {
    const shorthand = new RegExp(`\\b${gameId}\`?\\s+game\\s+folders\\b`, 'i');
    if (shorthand.test(section)) {
      patterns.add(`packages/core/src/games/${gameId}/`);
      patterns.add(`packages/cv/src/games/${gameId}/`);
      patterns.add(`apps/web/src/games/${gameId}/`);
      patterns.add(`docs/games/${gameId}.md`);
      patterns.add(`data/fixtures/${gameId}/`);
      patterns.add(`apps/web/public/samples/${gameId}/`);
    }
  }

  for (const match of section.matchAll(/`([^`]+)`/g)) {
    const token = match[1]?.trim() ?? '';
    if (!token) continue;
    // Skip prose tokens that aren't paths or filenames (e.g. script names like `check:repo`, types, or SQL identifiers).
    if (
      token.includes(' ') ||
      (!token.includes('/') &&
        !token.includes('.') &&
        !token.startsWith('*') &&
        token !== 'package.json' &&
        token !== 'README.md' &&
        token !== 'AGENTS.md')
    ) {
      continue;
    }
    for (const expanded of expandBraces(token)) {
      // Resolve bare subpaths under `apps/web/src/` or `scripts/` only when written as full repo paths;
      // if a spec writes a bare filename with `/` that doesn't start with a top-level folder, keep it as-is.
      patterns.add(expanded);
    }
  }

  return [...patterns];
}

export function matchesAnyPattern(filePath: string, patterns: readonly string[]): boolean {
  const normalized = filePath.replaceAll('\\', '/');
  return patterns.some((pattern) => patternToRegExp(pattern).test(normalized));
}

export type OwnershipCheckInput = {
  /** Current branch name (`main` or a feature/worktree branch). */
  branch: string;
  /** Changed files between base and HEAD. */
  changedFiles: readonly ChangedFile[];
  /** Map of changed spec path (`docs/slices/<id>-*.md`) → its markdown content. */
  specs: Record<string, string>;
};

export type OwnershipCheckResult = {
  failures: string[];
  notes: string[];
};

/**
 * Checks that a branch only edits files owned by the slice specs it modifies, plus
 * additive-only lines in shared wiring hub files (AGENTS.md → Parallel sessions).
 * On `main` (or when no slice spec is in the diff on `main`), reports notes instead of failing.
 */
export function checkOwnership({
  branch,
  changedFiles,
  specs,
}: OwnershipCheckInput): OwnershipCheckResult {
  const specEntries = Object.entries(specs);
  if (specEntries.length === 0) {
    if (branch === 'main') return { failures: [], notes: [] };
    return {
      failures: [],
      notes: ['No slice spec changed on this branch; ownership check skipped.'],
    };
  }

  const patterns = specEntries.flatMap(([path, content]) => parseSpecOwns(path, content));
  const specNames = specEntries.map(([path]) => path).join(', ');
  const isWSlice = specEntries.every(([path]) => /^docs\/slices\/W\d+-/.test(path));
  const reportOnly = branch === 'main' || isWSlice;

  const failures: string[] = [];
  const notes: string[] = [];

  for (const { path, removedLines } of changedFiles) {
    const normalized = path.replaceAll('\\', '/');
    if (matchesAnyPattern(normalized, patterns)) continue;

    const sharedDoc = SHARED_DOC_FILES.get(normalized);
    if (sharedDoc === 'edit') continue;
    if (sharedDoc === 'append') {
      if (removedLines === 0) continue;
      const msg = `${normalized}: shared doc has ${removedLines} removed/modified line(s); a slice only appends to it unless ${specNames} owns it (AGENTS.md → Parallel sessions → Shared docs).`;
      if (reportOnly) notes.push(msg);
      else failures.push(msg);
      continue;
    }

    if (ADDITIVE_WIRING_FILES.has(normalized)) {
      if (removedLines === 0) continue;
      const msg = `${normalized}: additive-wiring file has ${removedLines} removed/modified line(s), but ${specNames} does not own it. Keep existing lines untouched or add "${normalized}" to ## Owns / ## Shared change requests (AGENTS.md → Parallel sessions).`;
      if (reportOnly) notes.push(msg);
      else failures.push(msg);
      continue;
    }

    const msg = `${normalized}: not listed in ## Owns of ${specNames}. Edit only owned files, or request a shared change under ## Shared change requests (AGENTS.md → Parallel sessions).`;
    if (reportOnly) notes.push(msg);
    else failures.push(msg);
  }

  return { failures: failures.sort(), notes: notes.sort() };
}
