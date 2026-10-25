import net from 'node:net';

import { describe, expect, it } from 'vitest';

import { fillSupabase, findFreePort, LocalEnvError, NOT_RUNNING, pickPorts } from './local-env.mjs';

const status = { API_URL: 'http://127.0.0.1:54321', PUBLISHABLE_KEY: 'pub', SECRET_KEY: 'secret' };

describe('fillSupabase', () => {
  it('fills missing values from supabase status', () => {
    const env = {};
    fillSupabase(env, () => status);
    expect(env).toEqual({
      SUPABASE_URL: 'http://127.0.0.1:54321',
      SUPABASE_ANON_KEY: 'pub',
      SUPABASE_SERVICE_ROLE_KEY: 'secret',
      NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'pub',
    });
  });

  it('prefers ANON_KEY and SERVICE_ROLE_KEY when both kinds are printed', () => {
    const env = {};
    fillSupabase(env, () => ({ ...status, ANON_KEY: 'anon', SERVICE_ROLE_KEY: 'service' }));
    expect(env.SUPABASE_ANON_KEY).toBe('anon');
    expect(env.SUPABASE_SERVICE_ROLE_KEY).toBe('service');
  });

  it('keeps explicit values', () => {
    const env = { SUPABASE_URL: 'https://example.supabase.co' };
    fillSupabase(env, () => status);
    expect(env.SUPABASE_URL).toBe('https://example.supabase.co');
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe('http://127.0.0.1:54321');
  });

  it('never asks Supabase when everything is set', () => {
    const env = {
      SUPABASE_URL: 'a',
      SUPABASE_ANON_KEY: 'b',
      SUPABASE_SERVICE_ROLE_KEY: 'c',
      NEXT_PUBLIC_SUPABASE_URL: 'd',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'e',
    };
    fillSupabase(env, () => {
      throw new Error('should not be called');
    });
    expect(env.SUPABASE_URL).toBe('a');
  });

  it('fails with the "isn\'t running" message when Supabase is down', () => {
    expect(() => fillSupabase({}, () => undefined)).toThrow(new LocalEnvError(NOT_RUNNING));
  });
});

describe('ports', () => {
  it('skips a port that is in use', async () => {
    const start = await findFreePort(43_100);
    const server = net.createServer();
    await new Promise((resolve) => server.listen(start, resolve));
    try {
      expect(await findFreePort(start)).toBeGreaterThan(start);
    } finally {
      server.close();
    }
  });

  it('honors WEB_PORT / API_PORT and wires the URLs to them', async () => {
    const env = { WEB_PORT: '3105', API_PORT: '4105' };
    expect(await pickPorts(env)).toEqual({ webPort: 3105, apiPort: 4105 });
    expect(env.NEXT_PUBLIC_API_URL).toBe('http://localhost:4105');
    expect(env.WEB_ORIGINS).toBe('http://localhost:3105');
  });
});
