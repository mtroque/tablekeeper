import { SessionSchema } from '@tablekeeper/core';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../app';
import { createTestUser, deleteUsers, errorBody, testConfig, type TestUser } from '../test/helpers';

const config = testConfig();
const app = createApp(config);
let player: TestUser;

const save = (body: object) =>
  request(app).post('/v1/sessions').set('authorization', `Bearer ${player.token}`).send(body);

beforeAll(async () => {
  player = await createTestUser(config, 'harmonies-sessions');
});

afterAll(async () => {
  await deleteUsers(config, [player]);
});

describe('POST /v1/sessions for Harmonies', () => {
  it('recomputes the score of a board and ignores a sent total', async () => {
    const res = await save({
      gameId: 'harmonies',
      status: 'completed',
      state: {
        side: 'A',
        stacks: { '0,0': ['T', 'T', 'L'], '2,1': ['M', 'M'], '2,2': ['M'] },
        animalCards: [{ points: 9 }],
        spiritCards: [{ points: 14 }],
      },
      stateVersion: 1,
      scoreTotal: 999,
    });
    expect(res.status).toBe(201);
    const session = SessionSchema.parse(res.body);
    // Trees 7, mountains 4, side A water 0, animal cards 9, Nature's Spirit 14.
    expect(session.scoreTotal).toBe(34);
    expect(session.breakdown?.categories.map((row) => row.key)).toEqual([
      'trees',
      'mountains',
      'fields',
      'buildings',
      'water',
      'animals',
      'spirits',
    ]);
  });

  it('rejects a stack the rules never allow', async () => {
    const res = await save({
      gameId: 'harmonies',
      status: 'completed',
      state: { side: 'B', stacks: { '0,0': ['W', 'R'] }, animalCards: [] },
      stateVersion: 1,
    });
    expect(res.status).toBe(400);
    expect(errorBody(res).code).toBe('VALIDATION');
    expect(errorBody(res).details).toMatchObject({ issues: [{ path: 'stacks.0,0' }] });
  });
});
