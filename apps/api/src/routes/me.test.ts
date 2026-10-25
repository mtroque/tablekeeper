import { MeResponseSchema } from '@tablekeeper/core';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../app';
import { createTestUser, deleteUsers, errorBody, testConfig, type TestUser } from '../test/helpers';

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

  it('rejects a malformed authorization header', async () => {
    const res = await request(app).get('/v1/me').set('authorization', 'Basic abc');
    expect(res.status).toBe(401);
  });

  it('returns the profile created on sign-up', async () => {
    const res = await request(app).get('/v1/me').set('authorization', `Bearer ${user.token}`);
    expect(res.status).toBe(200);
    expect(MeResponseSchema.parse(res.body)).toEqual({
      id: user.id,
      displayName: 'Morgan Lee',
      email: user.email,
    });
  });
});
