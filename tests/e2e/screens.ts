// The screen map (W10): every screen and state, with how to reach it. `screens.spec.ts`
// photographs each entry, `pnpm shot <entry id>` reproduces one locally, and `pnpm check:repo`
// fails when a route has no entry (`scripts/lib/check-repo/screens.ts`).
// Helpers that touch the database are imported lazily, so `check:repo` can read the map cheaply.
import { expect, type Browser, type BrowserContext, type Page } from '@playwright/test';

/** The shared states of docs/UX.md → Screen states. */
export const SHARED_STATES = ['default', 'loading', 'empty', 'error', 'guest', 'offline'] as const;
export type SharedState = (typeof SHARED_STATES)[number];

export type ScreenRoute = {
  /** The `page.tsx` that renders it, as a Next path (`null` for the app shell and not-found). */
  page: string | null;
  /** Shared states this screen doesn't have, each with the reason. */
  skip: Partial<Record<SharedState, string>>;
};

const STATIC = 'a static page with no data, sign-in or network use';
const SHELL_OFFLINE = 'the only offline treatment is the shell status line (shell-offline)';
const FLOW_STORAGE = 'the score flow reads sessionStorage, so there is nothing to wait for';
const NO_SIGN_IN = 'works the same signed out; the guest header is in library';

/**
 * Screens: the rows of docs/UX.md → Routes, plus the app shell and the not-found page. Several
 * rows share one `page.tsx` (the score flow), so entries name their screen explicitly.
 */
export const SCREEN_ROUTES = {
  '/': {
    page: '/',
    skip: {
      loading: 'the library is rendered on the server from the game registry',
      empty: 'the supported games are built in',
      error: 'nothing is fetched',
      guest: 'the default shot is the guest view',
      offline: SHELL_OFFLINE,
    },
  },
  '/games/[gameId]': {
    page: '/games/[gameId]',
    skip: {
      loading: 'a server redirect to the first tab',
      empty: 'a server redirect to the first tab',
      error: 'an unknown game is the not-found screen',
      guest: 'a server redirect to the first tab',
      offline: 'a server redirect to the first tab',
    },
  },
  '/games/[gameId]/score': {
    page: '/games/[gameId]/score/[[...slug]]',
    skip: {
      loading: FLOW_STORAGE,
      empty: 'the score home is where a board starts; it has no list to be empty',
      guest: NO_SIGN_IN,
      offline: 'scoring works offline; the shell status line is the only change',
    },
  },
  '/games/[gameId]/score/capture': {
    page: '/games/[gameId]/score/[[...slug]]',
    skip: {
      loading: 'corner detection runs in a worker; no API call to hold',
      empty: 'capture always has a photo; without one it returns to the score home',
      error: 'a photo with no board found still shows default corners (no separate screen)',
      guest: NO_SIGN_IN,
      offline: 'photo reading runs on the device; the shell status line is the only change',
    },
  },
  '/games/[gameId]/score/review': {
    page: '/games/[gameId]/score/[[...slug]]',
    skip: {
      loading: FLOW_STORAGE,
      empty: 'the manual board (default) is the empty board',
      error: 'the editor makes no server calls',
      guest: NO_SIGN_IN,
      offline: 'the editor works offline; the shell status line is the only change',
    },
  },
  '/games/[gameId]/score/result': {
    page: '/games/[gameId]/score/[[...slug]]',
    skip: {
      loading: 'the breakdown is computed on the device',
      empty: 'a result always has a board; without one it returns to the score home',
    },
  },
  '/games/azul/score/[sessionId]': {
    page: '/games/[gameId]/score/[[...slug]]',
    skip: {
      loading: 'a guest game is read from this device',
      empty: 'a new game is round 1 (default)',
      error: 'an unknown game id is azul-game-missing',
      guest: 'the default shot is a guest game',
      offline: 'rounds are kept on the device; the shell status line is the only change',
    },
  },
  '/games/dorfromantik/score': {
    page: '/games/[gameId]/score/[[...slug]]',
    skip: {
      empty: 'a new campaign starts at game 1 (default)',
      guest: 'the default shot is a guest campaign',
    },
  },
  '/games/[gameId]/rules': {
    page: '/games/[gameId]/rules',
    skip: {
      guest: 'rules work signed out; the guest quota notice is rules-quota-guest',
    },
  },
  '/games/[gameId]/history': {
    page: '/games/[gameId]/history',
    skip: {},
  },
  '/games/[gameId]/history/[sessionId]': {
    page: '/games/[gameId]/history/[sessionId]',
    skip: {
      empty: 'a saved game always has a board; a missing id is history-detail-missing',
      offline: 'the cached game stays readable; history-offline shows the same treatment',
    },
  },
  '/games/dorfromantik/campaign': {
    page: '/games/[gameId]/campaign',
    skip: {
      guest: 'the default and empty shots are a guest campaign kept on the device',
      offline: SHELL_OFFLINE,
    },
  },
  '/auth/callback': {
    page: '/auth/callback',
    skip: {
      empty: 'nothing to list',
      guest: 'signing in is what this page does',
      offline: 'the sign-in redirect needs a connection before it lands here',
    },
  },
  '/privacy': {
    page: '/privacy',
    skip: {
      loading: STATIC,
      empty: STATIC,
      error: STATIC,
      guest: STATIC,
      offline: STATIC,
    },
  },
  'app shell': {
    page: null,
    skip: {
      empty: 'the header always has a title and the account control',
      guest: 'the guest header is in library',
    },
  },
  'not found': {
    page: null,
    skip: {
      loading: STATIC,
      empty: STATIC,
      error: 'this is the error page for unknown routes',
      guest: STATIC,
      offline: STATIC,
    },
  },
} as const satisfies Record<string, ScreenRoute>;

export type ScreenName = keyof typeof SCREEN_ROUTES;

export type TestAccount = { id: string; email: string; name: string; token: string };

export type ScreenContext = {
  page: Page;
  context: BrowserContext;
  /** Opens `path` (the entry's route by default) and waits for data and skeletons to settle. */
  goto: (path?: string, options?: { settle?: boolean }) => Promise<void>;
  /** Signs in a fresh `screens`-prefixed user, created on first use and deleted after the shot. */
  signIn: () => Promise<TestAccount>;
  /** Calls the API as the signed-in user. */
  api: <T>(path: string, init?: { method?: string; body?: unknown }) => Promise<T>;
};

export type ScreenEntry = {
  id: string;
  screen: ScreenName;
  /** The concrete URL the shot starts from. */
  route: string;
  /** A shared state, or a named game-specific one. */
  state: SharedState | (string & {});
  /** Sets the page up before the shot; the default opens the route and lets it settle. */
  reach?: (ctx: ScreenContext) => Promise<void>;
  dark?: true;
};

// ---- Reaching states, from existing test tooling ----

const API = {
  sessionsList: /\/v1\/sessions(?:\?|$)/,
  sessionDetail: /\/v1\/sessions\/[^/?]+$/,
  me: /\/v1\/me$/,
  quota: /\/v1\/me\/quota$/,
  ask: /\/rules\/ask$/,
  campaign: /\/v1\/campaigns\/[^/?]+$/,
};

/** Never answers, so the screen stays in its loading state. */
async function hold(page: Page, url: RegExp): Promise<void> {
  await page.route(url, () => {
    // Left pending on purpose.
  });
}

async function fail(page: Page, url: RegExp, method?: string): Promise<void> {
  await page.route(url, async (route) => {
    if (method && route.request().method() !== method) {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 500,
      json: { error: { code: 'INTERNAL', message: 'Something broke on the server.' } },
    });
  });
}

async function answer(page: Page, url: RegExp, body: unknown, status = 200): Promise<void> {
  await page.route(url, (route) => route.fulfill({ status, json: body }));
}

/** Holds the app's JavaScript, so the shot is the server render before hydration. */
async function serverRenderOnly(page: Page): Promise<void> {
  await page.route(/\/_next\/static\/.*\.js(?:\?|$)/, () => {
    // Left pending on purpose.
  });
}

async function goOffline({ page, context }: ScreenContext): Promise<void> {
  await context.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event('offline')));
  await expect(page.getByText("You're offline.").first()).toBeVisible();
}

const visible = (page: Page, text: string | RegExp) =>
  expect(page.getByText(text).first()).toBeVisible({ timeout: 15_000 });

async function enterByHand(ctx: ScreenContext, gameId: string): Promise<void> {
  await ctx.goto(`/games/${gameId}/score`);
  await ctx.page.getByRole('button', { name: 'Enter by Hand' }).click();
  await expect(ctx.page).toHaveURL(/\/score\/review$/);
}

async function patchworkResult(ctx: ScreenContext): Promise<void> {
  await enterByHand(ctx, 'patchwork');
  await ctx.page.getByRole('button', { name: 'All Covered' }).click();
  await ctx.page.getByRole('link', { name: 'See Score' }).click();
  await expect(ctx.page.getByTestId('score-total')).toBeVisible();
}

async function sampleCapture(ctx: ScreenContext, sample: string): Promise<void> {
  await ctx.goto('/games/patchwork/score');
  await ctx.page.getByRole('button', { name: sample }).click();
  await expect(ctx.page).toHaveURL(/\/score\/capture$/);
  // The first read loads opencv in the worker.
  await expect(ctx.page.getByRole('button', { name: 'Read Board' })).toBeVisible({
    timeout: 60_000,
  });
}

/** Saves a finished Patchwork board (all spaces empty) for the signed-in user. */
async function savePatchwork(ctx: ScreenContext, playedAt: string): Promise<string> {
  const { patchwork } = await import('../../packages/core/src');
  const saved = await ctx.api<{ id: string }>('/v1/sessions', {
    method: 'POST',
    body: {
      gameId: patchwork.id,
      status: 'completed',
      state: patchwork.initialState(),
      stateVersion: patchwork.stateVersion,
      playedAt,
    },
  });
  return saved.id;
}

const quota = (overrides: Record<string, unknown> = {}) => ({
  enabled: true,
  subject: 'guest',
  limit: 5,
  used: 1,
  remaining: 4,
  resetsAt: '2026-11-19T00:00:00.000Z',
  ...overrides,
});

const RULES_ANSWER = {
  answer:
    'Yes. You collect pralines each time your heart token moves past a praline symbol, whichever action you take.',
  notCovered: false,
  citations: [
    {
      sectionId: '00000000-0000-4000-8000-0000000000a1',
      title: 'Collecting pralines',
      printedPages: '4',
      pdfPage: 4,
      url: 'https://example.com/rulebook.pdf',
    },
  ],
  quota: quota({ used: 2, remaining: 3 }),
};

async function askStarter(ctx: ScreenContext): Promise<void> {
  await ctx.goto('/games/patchwork/rules');
  await ctx.page
    .getByRole('list', { name: 'Starter questions' })
    .getByRole('button')
    .first()
    .click();
}

async function finishDorfromantikGame(ctx: ScreenContext): Promise<void> {
  await ctx.goto('/games/dorfromantik/score');
  await expect(ctx.page.getByRole('heading', { name: 'Game 1' })).toBeVisible();
  await ctx.page.getByRole('button', { name: 'Finish Game' }).click();
  await expect(ctx.page.getByTestId('finish-total')).toBeVisible();
}

const MISSING_ID = '00000000-0000-4000-8000-00000000dead';

// ---- The map ----

export const SCREENS: readonly ScreenEntry[] = [
  // Library
  { id: 'library', screen: '/', route: '/', state: 'default' },
  { id: 'library-dark', screen: '/', route: '/', state: 'default', dark: true },

  // Game hub redirect
  {
    id: 'game-hub-redirect',
    screen: '/games/[gameId]',
    route: '/games/dorfromantik',
    state: 'default',
  },

  // Score home
  {
    id: 'score-home-patchwork',
    screen: '/games/[gameId]/score',
    route: '/games/patchwork/score',
    state: 'default',
  },
  {
    id: 'score-home-harmonies',
    screen: '/games/[gameId]/score',
    route: '/games/harmonies/score',
    state: 'default',
  },
  {
    id: 'score-home-resume',
    screen: '/games/[gameId]/score',
    route: '/games/patchwork/score',
    state: 'board-in-progress',
    reach: async (ctx) => {
      await enterByHand(ctx, 'patchwork');
      await ctx.goto();
      await visible(ctx.page, 'You have a board in progress.');
    },
  },
  {
    id: 'score-home-photo-error',
    screen: '/games/[gameId]/score',
    route: '/games/patchwork/score',
    state: 'error',
    reach: async (ctx) => {
      await ctx.goto();
      await ctx.page
        .locator('input[type="file"]')
        .last()
        .setInputFiles({ name: 'board.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('nope') });
      await visible(ctx.page, "Couldn't open that photo.");
    },
  },
  {
    id: 'score-home-azul',
    screen: '/games/[gameId]/score',
    route: '/games/azul/score',
    state: 'azul-no-games',
    reach: async (ctx) => {
      await ctx.goto();
      await visible(ctx.page, 'No games in progress on this device.');
    },
  },
  {
    id: 'score-home-azul-in-progress',
    screen: '/games/[gameId]/score',
    route: '/games/azul/score',
    state: 'azul-games-in-progress',
    reach: async (ctx) => {
      await ctx.goto();
      await ctx.page.getByRole('button', { name: 'New Game' }).click();
      await expect(ctx.page).toHaveURL(/\/games\/azul\/score\/[0-9a-f-]{36}$/);
      await ctx.goto();
    },
  },
  {
    id: 'score-home-azul-loading',
    screen: '/games/[gameId]/score',
    route: '/games/azul/score',
    state: 'azul-loading',
    reach: async (ctx) => {
      await ctx.signIn();
      await hold(ctx.page, API.sessionsList);
      await ctx.goto(undefined, { settle: false });
      await expect(
        ctx.page.locator('[aria-busy="true"], [data-slot="skeleton"]').first(),
      ).toBeVisible();
    },
  },

  // Capture
  {
    id: 'capture-patchwork-sample',
    screen: '/games/[gameId]/score/capture',
    route: '/games/patchwork/score/capture',
    state: 'default',
    reach: (ctx) => sampleCapture(ctx, 'Try Sample Photo 1'),
  },

  // Review
  {
    id: 'review-patchwork',
    screen: '/games/[gameId]/score/review',
    route: '/games/patchwork/score/review',
    state: 'default',
    reach: (ctx) => enterByHand(ctx, 'patchwork'),
  },
  {
    id: 'review-patchwork-dark',
    screen: '/games/[gameId]/score/review',
    route: '/games/patchwork/score/review',
    state: 'default',
    dark: true,
    reach: (ctx) => enterByHand(ctx, 'patchwork'),
  },
  {
    id: 'review-patchwork-low-confidence',
    screen: '/games/[gameId]/score/review',
    route: '/games/patchwork/score/review',
    state: 'low-confidence',
    reach: async (ctx) => {
      await sampleCapture(ctx, 'Try Sample Photo 2');
      await ctx.page.getByRole('button', { name: 'Read Board' }).click();
      await expect(ctx.page).toHaveURL(/\/score\/review$/, { timeout: 30_000 });
      await visible(ctx.page, /values? to check\./);
    },
  },
  {
    id: 'review-harmonies',
    screen: '/games/[gameId]/score/review',
    route: '/games/harmonies/score/review',
    state: 'default',
    reach: (ctx) => enterByHand(ctx, 'harmonies'),
  },

  // Result
  {
    id: 'result-signed-in',
    screen: '/games/[gameId]/score/result',
    route: '/games/patchwork/score/result',
    state: 'default',
    reach: async (ctx) => {
      await ctx.signIn();
      await patchworkResult(ctx);
      await expect(ctx.page.getByRole('button', { name: 'Save Game' })).toBeVisible();
    },
  },
  {
    id: 'result-guest',
    screen: '/games/[gameId]/score/result',
    route: '/games/patchwork/score/result',
    state: 'guest',
    reach: async (ctx) => {
      await patchworkResult(ctx);
      await visible(ctx.page, 'Save This Game');
    },
  },
  {
    id: 'result-save-error',
    screen: '/games/[gameId]/score/result',
    route: '/games/patchwork/score/result',
    state: 'error',
    reach: async (ctx) => {
      await ctx.signIn();
      await fail(ctx.page, API.sessionsList, 'POST');
      await patchworkResult(ctx);
      await ctx.page.getByRole('button', { name: 'Save Game' }).click();
      await visible(ctx.page, "Couldn't save the game. Try again.");
    },
  },
  {
    id: 'result-offline',
    screen: '/games/[gameId]/score/result',
    route: '/games/patchwork/score/result',
    state: 'offline',
    reach: async (ctx) => {
      await ctx.signIn();
      await patchworkResult(ctx);
      await goOffline(ctx);
      // Mutations pause while offline, so the save waits rather than failing (docs/UX.md
      // asks for "You're offline."); the shot shows what a player sees.
      await ctx.page.getByRole('button', { name: 'Save Game' }).click();
      await expect(ctx.page.getByRole('button', { name: 'Saving' })).toBeVisible();
    },
  },

  // Azul game in progress
  {
    id: 'azul-game',
    screen: '/games/azul/score/[sessionId]',
    route: '/games/azul/score',
    state: 'default',
    reach: async (ctx) => {
      await ctx.goto();
      await ctx.page.getByRole('button', { name: 'New Game' }).click();
      await expect(ctx.page.getByRole('heading', { name: 'Round 1' })).toBeVisible();
      await ctx.page.getByRole('button', { name: /^Row 1, column 1, / }).click();
      await ctx.page.getByRole('button', { name: /^Foundry line slot 2,/ }).click();
    },
  },
  {
    id: 'azul-game-missing',
    screen: '/games/azul/score/[sessionId]',
    route: `/games/azul/score/${MISSING_ID}`,
    state: 'missing',
  },

  // Dorfromantik scoresheet
  {
    id: 'dorfromantik-sheet',
    screen: '/games/dorfromantik/score',
    route: '/games/dorfromantik/score',
    state: 'default',
    reach: async (ctx) => {
      await ctx.goto();
      await expect(ctx.page.getByRole('heading', { name: 'Game 1' })).toBeVisible();
    },
  },
  {
    id: 'dorfromantik-sheet-loading',
    screen: '/games/dorfromantik/score',
    route: '/games/dorfromantik/score',
    state: 'loading',
    reach: async (ctx) => {
      await ctx.signIn();
      await hold(ctx.page, API.campaign);
      await ctx.goto(undefined, { settle: false });
      await expect(ctx.page.locator('[aria-busy="true"]').first()).toBeVisible();
    },
  },
  {
    id: 'dorfromantik-sheet-error',
    screen: '/games/dorfromantik/score',
    route: '/games/dorfromantik/score',
    state: 'error',
    reach: async (ctx) => {
      await ctx.signIn();
      await fail(ctx.page, API.campaign);
      await ctx.goto();
      await visible(ctx.page, "Couldn't load your campaign. Try again.");
    },
  },
  {
    id: 'dorfromantik-sheet-offline',
    screen: '/games/dorfromantik/score',
    route: '/games/dorfromantik/score',
    state: 'offline',
    reach: async (ctx) => {
      await ctx.goto();
      await expect(ctx.page.getByRole('heading', { name: 'Game 1' })).toBeVisible();
      await goOffline(ctx);
    },
  },
  {
    id: 'dorfromantik-finish',
    screen: '/games/dorfromantik/score',
    route: '/games/dorfromantik/score/finish',
    state: 'finish-and-unlocks',
    reach: finishDorfromantikGame,
  },

  // Rules
  {
    id: 'rules-empty',
    screen: '/games/[gameId]/rules',
    route: '/games/patchwork/rules',
    state: 'empty',
    reach: async (ctx) => {
      await answer(ctx.page, API.quota, quota());
      await ctx.goto();
      await expect(ctx.page.getByTestId('rules-empty')).toBeVisible();
    },
  },
  {
    id: 'rules-answer',
    screen: '/games/[gameId]/rules',
    route: '/games/patchwork/rules',
    state: 'default',
    reach: async (ctx) => {
      await answer(ctx.page, API.quota, quota());
      await answer(ctx.page, API.ask, RULES_ANSWER);
      await askStarter(ctx);
      await visible(ctx.page, 'whichever action you take');
    },
  },
  {
    id: 'rules-answer-dark',
    screen: '/games/[gameId]/rules',
    route: '/games/patchwork/rules',
    state: 'default',
    dark: true,
    reach: async (ctx) => {
      await answer(ctx.page, API.quota, quota());
      await answer(ctx.page, API.ask, RULES_ANSWER);
      await askStarter(ctx);
      await visible(ctx.page, 'whichever action you take');
    },
  },
  {
    id: 'rules-asking',
    screen: '/games/[gameId]/rules',
    route: '/games/patchwork/rules',
    state: 'loading',
    reach: async (ctx) => {
      await answer(ctx.page, API.quota, quota());
      await hold(ctx.page, API.ask);
      await askStarter(ctx);
      await visible(ctx.page, 'Reading the rulebook.');
    },
  },
  {
    id: 'rules-error',
    screen: '/games/[gameId]/rules',
    route: '/games/patchwork/rules',
    state: 'error',
    reach: async (ctx) => {
      await answer(ctx.page, API.quota, quota());
      await fail(ctx.page, API.ask);
      await askStarter(ctx);
      await expect(ctx.page.getByRole('button', { name: 'Try Again' })).toBeVisible();
    },
  },
  {
    id: 'rules-offline',
    screen: '/games/[gameId]/rules',
    route: '/games/patchwork/rules',
    state: 'offline',
    reach: async (ctx) => {
      await answer(ctx.page, API.quota, quota());
      await ctx.goto();
      await goOffline(ctx);
      await expect(ctx.page.getByTestId('rules-offline')).toBeVisible();
    },
  },
  {
    id: 'rules-quota-guest',
    screen: '/games/[gameId]/rules',
    route: '/games/patchwork/rules',
    state: 'quota-used-up',
    reach: async (ctx) => {
      await answer(ctx.page, API.quota, quota({ used: 5, remaining: 0 }));
      await ctx.goto();
      await expect(ctx.page.getByTestId('rules-quota')).toBeVisible();
    },
  },
  {
    id: 'rules-switched-off',
    screen: '/games/[gameId]/rules',
    route: '/games/patchwork/rules',
    state: 'switched-off',
    reach: async (ctx) => {
      await answer(ctx.page, API.quota, quota({ enabled: false }));
      await ctx.goto();
      await expect(ctx.page.getByTestId('rules-disabled')).toBeVisible();
    },
  },
  {
    id: 'rules-not-loaded',
    screen: '/games/[gameId]/rules',
    route: '/games/patchwork/rules',
    state: 'rulebook-not-loaded',
    reach: async (ctx) => {
      await answer(ctx.page, API.quota, quota());
      await answer(
        ctx.page,
        API.ask,
        { error: { code: 'NOT_FOUND', message: 'No rulebook for this game.' } },
        404,
      );
      await askStarter(ctx);
      await expect(ctx.page.getByTestId('rules-missing')).toBeVisible();
    },
  },

  // History
  {
    id: 'history-guest',
    screen: '/games/[gameId]/history',
    route: '/games/patchwork/history',
    state: 'guest',
    reach: async (ctx) => {
      await ctx.goto();
      await visible(ctx.page, 'Keep a History');
    },
  },
  {
    id: 'history-loading',
    screen: '/games/[gameId]/history',
    route: '/games/patchwork/history',
    state: 'loading',
    reach: async (ctx) => {
      await ctx.signIn();
      await hold(ctx.page, API.sessionsList);
      await ctx.goto(undefined, { settle: false });
      await expect(ctx.page.locator('[aria-busy="true"]').first()).toBeVisible();
    },
  },
  {
    id: 'history-empty',
    screen: '/games/[gameId]/history',
    route: '/games/patchwork/history',
    state: 'empty',
    reach: async (ctx) => {
      await ctx.signIn();
      await ctx.goto();
      await visible(ctx.page, 'Games you save show up here.');
    },
  },
  {
    id: 'history',
    screen: '/games/[gameId]/history',
    route: '/games/patchwork/history',
    state: 'default',
    reach: async (ctx) => {
      await ctx.signIn();
      await savePatchwork(ctx, '2026-11-01T19:30:00.000Z');
      await savePatchwork(ctx, '2026-11-08T20:15:00.000Z');
      await ctx.goto();
      await expect(ctx.page.getByTestId('history-item')).toHaveCount(2);
    },
  },
  {
    id: 'history-error',
    screen: '/games/[gameId]/history',
    route: '/games/patchwork/history',
    state: 'error',
    reach: async (ctx) => {
      await ctx.signIn();
      await fail(ctx.page, API.sessionsList);
      await ctx.goto();
      await visible(ctx.page, "Couldn't load your history. Try again.");
    },
  },
  {
    id: 'history-offline',
    screen: '/games/[gameId]/history',
    route: '/games/patchwork/history',
    state: 'offline',
    reach: async (ctx) => {
      await ctx.signIn();
      await savePatchwork(ctx, '2026-11-08T20:15:00.000Z');
      await ctx.goto();
      await expect(ctx.page.getByTestId('history-item')).toHaveCount(1);
      await goOffline(ctx);
    },
  },

  // Saved game
  {
    id: 'history-detail',
    screen: '/games/[gameId]/history/[sessionId]',
    route: '/games/patchwork/history/<saved game>',
    state: 'default',
    reach: async (ctx) => {
      await ctx.signIn();
      const id = await savePatchwork(ctx, '2026-11-08T20:15:00.000Z');
      await ctx.goto(`/games/patchwork/history/${id}`);
      await expect(ctx.page.getByTestId('score-total')).toBeVisible();
    },
  },
  {
    id: 'history-detail-guest',
    screen: '/games/[gameId]/history/[sessionId]',
    route: `/games/patchwork/history/${MISSING_ID}`,
    state: 'guest',
    reach: async (ctx) => {
      await ctx.goto();
      await visible(ctx.page, 'Sign In to See This Game');
    },
  },
  {
    id: 'history-detail-loading',
    screen: '/games/[gameId]/history/[sessionId]',
    route: `/games/patchwork/history/${MISSING_ID}`,
    state: 'loading',
    reach: async (ctx) => {
      await ctx.signIn();
      await hold(ctx.page, API.sessionDetail);
      await ctx.goto(undefined, { settle: false });
      await expect(ctx.page.locator('[aria-busy="true"]').first()).toBeVisible();
    },
  },
  {
    id: 'history-detail-error',
    screen: '/games/[gameId]/history/[sessionId]',
    route: `/games/patchwork/history/${MISSING_ID}`,
    state: 'error',
    reach: async (ctx) => {
      await ctx.signIn();
      await fail(ctx.page, API.sessionDetail);
      await ctx.goto();
      await visible(ctx.page, "Couldn't load this game. Try again.");
    },
  },
  {
    id: 'history-detail-missing',
    screen: '/games/[gameId]/history/[sessionId]',
    route: `/games/patchwork/history/${MISSING_ID}`,
    state: 'missing',
    reach: async (ctx) => {
      await ctx.signIn();
      await ctx.goto();
      await visible(ctx.page, "This game wasn't found.");
    },
  },

  // Dorfromantik campaign
  {
    id: 'campaign-empty',
    screen: '/games/dorfromantik/campaign',
    route: '/games/dorfromantik/campaign',
    state: 'empty',
    reach: async (ctx) => {
      await ctx.goto();
      await visible(ctx.page, 'No games in this campaign yet.');
    },
  },
  {
    id: 'campaign',
    screen: '/games/dorfromantik/campaign',
    route: '/games/dorfromantik/campaign',
    state: 'default',
    reach: async (ctx) => {
      await finishDorfromantikGame(ctx);
      await ctx.goto('/games/dorfromantik/campaign');
      await expect(ctx.page.getByTestId('games-played')).toHaveText('1');
    },
  },
  {
    id: 'campaign-loading',
    screen: '/games/dorfromantik/campaign',
    route: '/games/dorfromantik/campaign',
    state: 'loading',
    reach: async (ctx) => {
      await ctx.signIn();
      await hold(ctx.page, API.campaign);
      await ctx.goto(undefined, { settle: false });
      await expect(ctx.page.locator('[aria-busy="true"]').first()).toBeVisible();
    },
  },
  {
    id: 'campaign-error',
    screen: '/games/dorfromantik/campaign',
    route: '/games/dorfromantik/campaign',
    state: 'error',
    reach: async (ctx) => {
      await ctx.signIn();
      await fail(ctx.page, API.campaign);
      await ctx.goto();
      await visible(ctx.page, "Couldn't load your campaign. Try again.");
    },
  },

  // Sign-in callback
  {
    id: 'callback-signing-in',
    screen: '/auth/callback',
    route: '/auth/callback',
    state: 'loading',
    reach: async (ctx) => {
      await serverRenderOnly(ctx.page);
      await ctx.goto(undefined, { settle: false });
      await visible(ctx.page, 'Signing you in.');
    },
  },
  {
    id: 'callback-success',
    screen: '/auth/callback',
    route: '/auth/callback',
    state: 'default',
    reach: async (ctx) => {
      await ctx.signIn();
      await ctx.page.addInitScript(() => {
        sessionStorage.setItem('tk:v1:auth-return-to', '/games/patchwork/history');
      });
      await ctx.goto(undefined, { settle: false });
      await expect(ctx.page).toHaveURL(/\/games\/patchwork\/history$/);
      await visible(ctx.page, 'Games you save show up here.');
    },
  },
  {
    id: 'callback-failed',
    screen: '/auth/callback',
    route: '/auth/callback?error=access_denied',
    state: 'error',
    reach: async (ctx) => {
      await ctx.goto();
      await visible(ctx.page, "Couldn't finish signing in with Google.");
    },
  },

  // Privacy
  { id: 'privacy', screen: '/privacy', route: '/privacy', state: 'default' },

  // App shell
  {
    id: 'shell-header-loading',
    screen: 'app shell',
    route: '/',
    state: 'loading',
    reach: async (ctx) => {
      await serverRenderOnly(ctx.page);
      await ctx.goto(undefined, { settle: false });
      await expect(ctx.page.getByTestId('account-loading')).toBeVisible();
    },
  },
  {
    id: 'shell-signed-in',
    screen: 'app shell',
    route: '/',
    state: 'default',
    reach: async (ctx) => {
      const user = await ctx.signIn();
      await ctx.goto();
      await expect(ctx.page.getByRole('button', { name: `Account: ${user.name}` })).toBeVisible();
    },
  },
  {
    id: 'shell-account-sheet',
    screen: 'app shell',
    route: '/',
    state: 'account-sheet',
    reach: async (ctx) => {
      const user = await ctx.signIn();
      await ctx.goto();
      await ctx.page.getByRole('button', { name: `Account: ${user.name}` }).click();
      await expect(ctx.page.getByTestId('account-name')).toHaveText(user.name);
    },
  },
  {
    id: 'shell-account-sheet-loading',
    screen: 'app shell',
    route: '/',
    state: 'account-sheet-loading',
    reach: async (ctx) => {
      await ctx.signIn();
      await hold(ctx.page, API.me);
      await ctx.goto(undefined, { settle: false });
      await ctx.page.getByRole('button', { name: /^Account: / }).click();
      await expect(ctx.page.getByRole('button', { name: 'Sign Out' })).toBeVisible();
    },
  },
  {
    id: 'shell-account-sheet-error',
    screen: 'app shell',
    route: '/',
    state: 'error',
    reach: async (ctx) => {
      await ctx.signIn();
      await fail(ctx.page, API.me);
      await ctx.goto();
      await ctx.page.getByRole('button', { name: /^Account: / }).click();
      await visible(ctx.page, "Couldn't load your profile.");
    },
  },
  {
    id: 'shell-offline',
    screen: 'app shell',
    route: '/',
    state: 'offline',
    reach: async (ctx) => {
      await ctx.goto();
      await goOffline(ctx);
    },
  },

  // Not found
  {
    id: 'not-found',
    screen: 'not found',
    route: '/games/chess',
    state: 'default',
    reach: async (ctx) => {
      await ctx.goto();
      await expect(ctx.page.getByRole('heading', { name: 'Page Not Found' })).toBeVisible();
    },
  },
];

export const VIEWPORT = { width: 390, height: 844 };

export function findScreen(id: string): ScreenEntry | undefined {
  return SCREENS.find((entry) => entry.id === id);
}

/**
 * Opens a fresh context for the entry, reaches its state and saves a full-page PNG to `path`.
 * Users and data it created are removed afterwards, even when reaching the state fails.
 */
export async function shootScreen(
  entry: ScreenEntry,
  { browser, baseURL, path }: { browser: Browser; baseURL: string; path: string },
): Promise<void> {
  const context = await browser.newContext({
    baseURL,
    viewport: VIEWPORT,
    colorScheme: entry.dark ? 'dark' : 'light',
  });
  const page = await context.newPage();
  const users: { id: string; email: string; name: string }[] = [];
  let account: TestAccount | null = null;

  const settle = async () => {
    await page
      .waitForFunction(
        () => !document.querySelector('[aria-busy="true"], [data-slot="skeleton"]'),
        undefined,
        { timeout: 10_000 },
      )
      .catch(() => {});
  };

  const ctx: ScreenContext = {
    page,
    context,
    goto: async (path = entry.route, options = {}) => {
      const settleAfter = options.settle ?? true;
      await page.goto(path, { waitUntil: settleAfter ? 'networkidle' : 'commit' });
      if (settleAfter) await settle();
    },
    signIn: async () => {
      if (account) return account;
      const helpers = await import('./helpers');
      const user = await helpers.createTestUser('screens', 'Screen Player');
      users.push(user);
      const session = await helpers.signTestSession(user);
      await helpers.signInWithSession(page, session);
      const { token } = JSON.parse(session) as { token: string };
      account = { ...user, token };
      return account;
    },
    api: async <T>(path: string, init: { method?: string; body?: unknown } = {}) => {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      if (!apiUrl) throw new Error('NEXT_PUBLIC_API_URL missing; the test config fills it.');
      if (!account) throw new Error('Call signIn() before api().');
      const res = await fetch(`${apiUrl}${path}`, {
        method: init.method ?? 'GET',
        headers: {
          authorization: `Bearer ${account.token}`,
          'content-type': 'application/json',
        },
        ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
      });
      if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${path}: ${res.status}`);
      return (await res.json()) as T;
    },
  };

  try {
    await (entry.reach ?? ((c: ScreenContext) => c.goto()))(ctx);
    // The Next dev indicator isn't part of the app.
    await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
    await page.waitForTimeout(200);
    await page.screenshot({ path, fullPage: true, animations: 'disabled' });
  } finally {
    await context.close();
    if (users.length > 0) {
      const helpers = await import('./helpers');
      await helpers.deleteTestUsers(users);
    }
  }
}
