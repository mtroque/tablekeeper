import { describe, expect, it } from 'vitest';

import { checkScreenMap, pageRoute, parseUxRoutes } from './screens';

const STATES = ['default', 'loading'];
const base = {
  uxRoutes: ['/', '/privacy'],
  sharedStates: STATES,
  screens: {
    '/': { page: '/', skip: { loading: 'static' } },
    '/privacy': { page: '/privacy', skip: { loading: 'static' } },
  },
  entries: [
    { id: 'library', screen: '/', state: 'default' },
    { id: 'privacy', screen: '/privacy', state: 'default' },
  ],
};
const PAGES = ['apps/web/src/app/page.tsx', 'apps/web/src/app/privacy/page.tsx'];

describe('pageRoute', () => {
  it('turns page files into routes and ignores dev/ and route groups', () => {
    expect(pageRoute('apps/web/src/app/page.tsx')).toBe('/');
    expect(pageRoute('apps/web/src/app/games/[gameId]/score/[[...slug]]/page.tsx')).toBe(
      '/games/[gameId]/score/[[...slug]]',
    );
    expect(pageRoute('apps/web/src/app/(marketing)/about/page.tsx')).toBe('/about');
    expect(pageRoute('apps/web/src/app/dev/cv/page.tsx')).toBeNull();
    expect(pageRoute('apps/web/src/app/layout.tsx')).toBeNull();
  });
});

describe('parseUxRoutes', () => {
  it('reads the route column of the Routes table only', () => {
    const md =
      '## Routes\n\n| Route | Screen |\n|---|---|\n| `/` | Library |\n| `/privacy` | Policy |\n\n## Other\n\n| `/nope` | x |\n';
    expect(parseUxRoutes(md)).toEqual(['/', '/privacy']);
  });
});

describe('checkScreenMap', () => {
  it('passes when every route has entries and every state is covered or skipped', () => {
    expect(checkScreenMap({ ...base, pageFiles: PAGES })).toEqual([]);
  });

  it('ignores dev/ pages', () => {
    expect(
      checkScreenMap({ ...base, pageFiles: [...PAGES, 'apps/web/src/app/dev/cv/page.tsx'] }),
    ).toEqual([]);
  });

  it('fails on a new route without an entry, naming the route and the map file', () => {
    expect(
      checkScreenMap({ ...base, pageFiles: [...PAGES, 'apps/web/src/app/stats/page.tsx'] }),
    ).toEqual([
      'apps/web/src/app/stats/page.tsx: route /stats has no entry in tests/e2e/screens.ts. Add it to SCREEN_ROUTES with its states, and entries to SCREENS (docs/UX.md → Screen states).',
    ]);
  });

  it('fails on a UX route without a screen, a screen without entries, and uncovered states', () => {
    const failures = checkScreenMap({
      ...base,
      pageFiles: PAGES,
      uxRoutes: [...base.uxRoutes, '/stats'],
      screens: { ...base.screens, '/privacy': { page: '/privacy', skip: {} } },
      entries: [
        { id: 'library', screen: '/', state: 'default' },
        { id: 'library', screen: '/', state: 'loading' },
        { id: 'privacy', screen: '/privacy', state: 'default' },
        { id: 'ghost', screen: '/ghost', state: 'default' },
      ],
    });
    expect(failures).toEqual([
      'docs/UX.md: route /stats (Routes) has no screen in tests/e2e/screens.ts. Add it to SCREEN_ROUTES and SCREENS.',
      'tests/e2e/screens.ts: entry id library is used twice.',
      'tests/e2e/screens.ts: entry ghost names unknown screen /ghost. Use a key of SCREEN_ROUTES.',
      'tests/e2e/screens.ts: screen / both has a loading entry and skips it. Remove one.',
      'tests/e2e/screens.ts: screen /privacy has no loading entry. Add one, or a reason in its skip list (docs/UX.md → Screen states).',
    ]);
  });
});
