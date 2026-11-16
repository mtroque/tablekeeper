import { MeResponseSchema } from '@tablekeeper/core';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../app';
import {
  createTestUser,
  deleteUsers,
  errorBody,
  signTestToken,
  testConfig,
  type TestUser,
} from '../test/helpers';

const config = testConfig();
const app = createApp(config);
let user: TestUser;

beforeAll(async () => {
  user = await createTestUser(config, 's0-me', 'Morgan Lee');
});

afterAll(async () => {
  await deleteUsers(config, [user]);
});

describe('GET /v1/me', () => {
  it('returns the 401 envelope without a token', async () => {
    const res = await request(app).get('/v1/me');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      error: { code: 'UNAUTHENTICATED', message: 'Sign in to do this.' },
    });
  });

  it('rejects an invalid token', async () => {
    const res = await request(app).get('/v1/me').set('authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(401);
    expect(errorBody(res).code).toBe('UNAUTHENTICATED');
  });

  it('rejects an expired token', async () => {
    const expired = await signTestToken(config, user, {
      expiresIn: Math.floor(Date.now() / 1000) - 60,
    });
    const res = await request(app).get('/v1/me').set('authorization', `Bearer ${expired}`);
    expect(res.status).toBe(401);
    expect(errorBody(res).code).toBe('UNAUTHENTICATED');
  });

  it('rejects a foreign-issuer token', async () => {
    const foreign = await signTestToken(config, user, { issuer: 'https://evil.example/auth' });
    const res = await request(app).get('/v1/me').set('authorization', `Bearer ${foreign}`);
    expect(res.status).toBe(401);
    expect(errorBody(res).code).toBe('UNAUTHENTICATED');
  });

  it('rejects a malformed authorization header', async () => {
    const res = await request(app).get('/v1/me').set('authorization', 'Basic abc');
    expect(res.status).toBe(401);
  });

  it('creates and returns the profile on first authenticated request', async () => {
    const res = await request(app).get('/v1/me').set('authorization', `Bearer ${user.token}`);
    expect(res.status).toBe(200);
    expect(MeResponseSchema.parse(res.body)).toEqual({
      id: user.id,
      displayName: 'Morgan Lee',
      email: user.email,
    });
  });
});
