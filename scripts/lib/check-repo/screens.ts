// Route coverage for the screen map (W10): every `page.tsx` route and every row of
// docs/UX.md → Routes has map entries, and every screen covers each shared state or says why not.

export const SCREEN_MAP_FILE = 'tests/e2e/screens.ts';
const APP_DIR = 'apps/web/src/app/';

export type ScreenMapInput = {
  /** Repo-relative paths of every `page.tsx` under `apps/web/src/app/`. */
  pageFiles: readonly string[];
  /** Route patterns from docs/UX.md → Routes. */
  uxRoutes: readonly string[];
  sharedStates: readonly string[];
  screens: Readonly<
    Record<string, { page: string | null; skip: Readonly<Partial<Record<string, string>>> }>
  >;
  entries: readonly { id: string; screen: string; state: string }[];
};

/** `apps/web/src/app/games/[gameId]/page.tsx` → `/games/[gameId]`; `null` for `dev/` pages. */
export function pageRoute(file: string): string | null {
  const normalized = file.replaceAll('\\', '/');
  if (!normalized.startsWith(APP_DIR) || !normalized.endsWith('/page.tsx')) return null;
  const segments = normalized
    .slice(APP_DIR.length, -'/page.tsx'.length)
    .split('/')
    .filter((segment) => segment !== '' && !/^\(.*\)$/.test(segment));
  if (segments[0] === 'dev') return null;
  return `/${segments.join('/')}`;
}

/** The route column of docs/UX.md → Routes. */
export function parseUxRoutes(markdown: string): string[] {
  const start = markdown.search(/^## Routes\s*$/m);
  if (start === -1) return [];
  const rest = markdown.slice(start).split(/\r?\n/).slice(1);
  const end = rest.findIndex((line) => line.startsWith('## '));
  const section = end === -1 ? rest : rest.slice(0, end);
  return section.flatMap((line) => {
    const match = /^\|\s*`([^`]+)`\s*\|/.exec(line);
    return match?.[1] ? [match[1]] : [];
  });
}

export function checkScreenMap({
  pageFiles,
  uxRoutes,
  sharedStates,
  screens,
  entries,
}: ScreenMapInput): string[] {
  const failures: string[] = [];
  const mapped = new Set(Object.values(screens).map((screen) => screen.page));

  for (const file of pageFiles) {
    const route = pageRoute(file);
    if (route === null || mapped.has(route)) continue;
    failures.push(
      `${file}: route ${route} has no entry in ${SCREEN_MAP_FILE}. Add it to SCREEN_ROUTES with its states, and entries to SCREENS (docs/UX.md → Screen states).`,
    );
  }

  for (const route of uxRoutes) {
    if (route in screens) continue;
    failures.push(
      `docs/UX.md: route ${route} (Routes) has no screen in ${SCREEN_MAP_FILE}. Add it to SCREEN_ROUTES and SCREENS.`,
    );
  }

  const ids = new Set<string>();
  for (const entry of entries) {
    if (ids.has(entry.id)) {
      failures.push(`${SCREEN_MAP_FILE}: entry id ${entry.id} is used twice.`);
    }
    ids.add(entry.id);
    if (!(entry.screen in screens)) {
      failures.push(
        `${SCREEN_MAP_FILE}: entry ${entry.id} names unknown screen ${entry.screen}. Use a key of SCREEN_ROUTES.`,
      );
    }
  }

  for (const [name, screen] of Object.entries(screens)) {
    const states = new Set(entries.filter((e) => e.screen === name).map((e) => e.state));
    if (states.size === 0) {
      failures.push(`${SCREEN_MAP_FILE}: screen ${name} has no entries in SCREENS.`);
      continue;
    }
    for (const state of sharedStates) {
      const reason = screen.skip[state];
      if (states.has(state) && reason !== undefined) {
        failures.push(
          `${SCREEN_MAP_FILE}: screen ${name} both has a ${state} entry and skips it. Remove one.`,
        );
      } else if (!states.has(state) && !reason?.trim()) {
        failures.push(
          `${SCREEN_MAP_FILE}: screen ${name} has no ${state} entry. Add one, or a reason in its skip list (docs/UX.md → Screen states).`,
        );
      }
    }
  }

  return failures;
}
