import { describe, expect, it } from 'vitest';

import {
  parseShotArgs,
  parseShotRequest,
  routeSlug,
  sanitizeBranchName,
  shotFilename,
} from './shot-args';

describe('parseShotArgs', () => {
  it('parses route and flags with default signed-in user', () => {
    expect(parseShotArgs(['/games/patchwork/score', '--dark'])).toEqual({
      route: '/games/patchwork/score',
      signedInUser: null,
      offline: false,
      dark: true,
      waitSelector: null,
    });

    expect(parseShotArgs(['/games/patchwork/history', '--signed-in', '--offline'])).toEqual({
      route: '/games/patchwork/history',
      signedInUser: 'default',
      offline: true,
      dark: false,
      waitSelector: null,
    });

    expect(
      parseShotArgs(['games/azul/rules', '--signed-in', 'patchwork', '--wait', '[role="main"]']),
    ).toEqual({
      route: '/games/azul/rules',
      signedInUser: 'patchwork',
      offline: false,
      dark: false,
      waitSelector: '[role="main"]',
    });
  });

  it('rejects missing route, missing --wait value, and unknown flags', () => {
    expect(() => parseShotArgs([])).toThrow(/Usage:/);
    expect(() => parseShotArgs(['/privacy', '--nope'])).toThrow(/Unknown flag.*Usage:/s);
    expect(() => parseShotArgs(['/privacy', '--wait'])).toThrow(/--wait requires a selector/);
  });
});

describe('routeSlug & shotFilename', () => {
  it('builds deterministic slugs and filenames', () => {
    expect(routeSlug('/')).toBe('home');
    expect(routeSlug('/games/patchwork/score?step=1')).toBe('games-patchwork-score');
    expect(
      shotFilename({
        route: '/games/patchwork/score',
        signedInUser: null,
        offline: false,
        dark: true,
      }),
    ).toBe('games-patchwork-score-guest-dark.png');
    expect(
      shotFilename({
        route: '/games/patchwork/history',
        signedInUser: 'patchwork',
        offline: true,
        dark: false,
      }),
    ).toBe('games-patchwork-history-signed-in-patchwork-offline-light.png');
    expect(sanitizeBranchName('slice/W15')).toBe('slice-W15');
  });
});

describe('parseShotRequest', () => {
  const ids = new Set(['history-empty', 'privacy']);

  it('shoots a screen map entry by id', () => {
    expect(parseShotRequest(['history-empty'], ids)).toEqual({
      kind: 'entry',
      id: 'history-empty',
    });
  });

  it('treats anything else as a route, including an entry id with flags', () => {
    expect(parseShotRequest(['/privacy'], ids)).toMatchObject({ kind: 'route', route: '/privacy' });
    expect(parseShotRequest(['privacy', '--dark'], ids)).toMatchObject({
      kind: 'route',
      route: '/privacy',
      dark: true,
    });
    expect(() => parseShotRequest([], ids)).toThrow(/screen map entry id/);
  });
});
