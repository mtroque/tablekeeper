import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../app';
import {
  createTestUser,
  deleteUsers,
  signTestToken,
  testConfig,
  type TestUser,
} from '../test/helpers';

import { neonAuthEndpoints } from './auth';

// Neon Auth's documented token shape, as literals: tokens carry the base URL's origin as `iss`,
// and the JWKS sits under the full base URL. X4 shipped with `iss` = the full base URL, and every
// signed-in request in production failed with 401 while tests built tokens the same wrong way.
const BASE_URL = 'https://ep-x.neonauth.example/neondb/auth';
const ISSUER = 'https://ep-x.neonauth.example';
const JWKS_URL = 'https://ep-x.neonauth.example/neondb/auth/.well-known/jwks.json';

describe('neonAuthEndpoints', () => {
  it('uses the origin as the issuer and keeps the path for the JWKS', () => {
    expect(neonAuthEndpoints(BASE_URL)).toEqual({ issuer: ISSUER, jwksUrl: JWKS_URL });
    expect(neonAuthEndpoints(`${BASE_URL}/`)).toEqual({ issuer: ISSUER, jwksUrl: JWKS_URL });
  });
});

describe('optionalAuth issuer check', () => {
  const config = testConfig({ NEON_AUTH_BASE_URL: BASE_URL });
  const app = createApp(config);
  let user: TestUser;

  beforeAll(async () => {
    user = await createTestUser(config, 'w26-issuer', 'Issuer Check');
  });

  afterAll(async () => {
    await deleteUsers(config, [user]);
  });

  it("accepts a token with the base URL's origin as issuer", async () => {
    const token = await signTestToken(config, user, { issuer: ISSUER });
    const res = await request(app).get('/v1/me').set('authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it('rejects a token with the full base URL as issuer', async () => {
    const token = await signTestToken(config, user, { issuer: BASE_URL });
    const res = await request(app).get('/v1/me').set('authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
  });
});
