import net from 'node:net';

import { describe, expect, it } from 'vitest';

import {
  fillLocalDefaults,
  findFreePort,
  LOCAL_AUTH_TEST_SECRET,
  LOCAL_AUTH_URL,
  LOCAL_DATABASE_URL,
  pickPorts,
} from './local-env.mjs';

describe('fillLocalDefaults', () => {
  it('fills missing local database and test-auth values', () => {
    const env = {};
    fillLocalDefaults(env);
    expect(env).toEqual({
      DATABASE_URL: LOCAL_DATABASE_URL,
      NEON_AUTH_BASE_URL: LOCAL_AUTH_URL,
      NEXT_PUBLIC_NEON_AUTH_URL: LOCAL_AUTH_URL,
      AUTH_TEST_SECRET: LOCAL_AUTH_TEST_SECRET,
    });
  });

  it('keeps explicit values', () => {
    const env = {
      DATABASE_URL: 'postgresql://neondb_owner:pw@ep-test.neon.tech/neondb',
      NEON_AUTH_BASE_URL: 'https://ep-test.neonauth.us-east-1.aws.neon.tech/neondb/auth',
    };
    fillLocalDefaults(env);
    expect(env.DATABASE_URL).toBe('postgresql://neondb_owner:pw@ep-test.neon.tech/neondb');
    expect(env.NEON_AUTH_BASE_URL).toBe(
      'https://ep-test.neonauth.us-east-1.aws.neon.tech/neondb/auth',
    );
    expect(env.NEXT_PUBLIC_NEON_AUTH_URL).toBe(LOCAL_AUTH_URL);
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
