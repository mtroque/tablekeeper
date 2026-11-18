import { TEST_USERS } from './test-users.mjs';

export type ShotOptions = {
  route: string;
  signedInUser: keyof typeof TEST_USERS | null;
  offline: boolean;
  dark: boolean;
  waitSelector: string | null;
};

export const SHOT_USAGE =
  'Usage: pnpm shot <route> [--signed-in [user]] [--offline] [--dark] [--wait <selector>]';

const KNOWN_USERS = new Set(Object.keys(TEST_USERS));

export function parseShotArgs(argv: readonly string[]): ShotOptions {
  let route: string | null = null;
  let signedInUser: keyof typeof TEST_USERS | null = null;
  let offline = false;
  let dark = false;
  let waitSelector: string | null = null;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] ?? '';
    if (arg === '--offline') {
      offline = true;
    } else if (arg === '--dark') {
      dark = true;
    } else if (arg === '--wait') {
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) {
        throw new Error(`--wait requires a selector.\n${SHOT_USAGE}`);
      }
      waitSelector = next;
      i += 1;
    } else if (arg === '--signed-in') {
      const next = argv[i + 1];
      if (next && !next.startsWith('--') && KNOWN_USERS.has(next)) {
        signedInUser = next as keyof typeof TEST_USERS;
        i += 1;
      } else {
        signedInUser = 'default';
      }
    } else if (arg.startsWith('--')) {
      throw new Error(`Unknown flag: ${arg}\n${SHOT_USAGE}`);
    } else if (route === null) {
      route = arg.startsWith('/') ? arg : `/${arg}`;
    } else {
      throw new Error(`Unexpected argument: ${arg}\n${SHOT_USAGE}`);
    }
  }

  if (!route) {
    throw new Error(`Missing <route>.\n${SHOT_USAGE}`);
  }

  return { route, signedInUser, offline, dark, waitSelector };
}

export function routeSlug(route: string): string {
  const cleaned = route
    .split('?')[0]
    ?.replace(/^\/+|\/+$/g, '')
    .replaceAll(/[^a-zA-Z0-9]+/g, '-')
    .replaceAll(/^-+|-+$/g, '')
    .toLowerCase();
  return cleaned || 'home';
}

export function shotFilename(
  opts: Pick<ShotOptions, 'route' | 'signedInUser' | 'offline' | 'dark'>,
): string {
  const slug = routeSlug(opts.route);
  const authPart = opts.signedInUser ? `signed-in-${opts.signedInUser}` : 'guest';
  const state = opts.offline ? `${authPart}-offline` : authPart;
  const theme = opts.dark ? 'dark' : 'light';
  return `${slug}-${state}-${theme}.png`;
}

export function sanitizeBranchName(branch: string): string {
  return branch.trim().replaceAll(/[^a-zA-Z0-9._-]+/g, '-') || 'local';
}
