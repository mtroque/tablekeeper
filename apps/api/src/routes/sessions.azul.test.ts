import { emptyWall, SessionSchema, wallIndex } from '@tablekeeper/core';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../app';
import { createTestUser, deleteUsers, errorBody, testConfig, type TestUser } from '../test/helpers';

const config = testConfig();
const app = createApp(config);
let player: TestUser;

const bearer = () => `Bearer ${player.token}`;

function wall(...cells: Array<[number, number]>): boolean[] {
  const next = emptyWall();
  for (const [row, col] of cells) next[wallIndex(row, col)] = true;
  return next;
}

// The worked rounds in docs/games/azul.md: 0 after round 1, 6 after round 2.
const round1 = { wall: wall([0, 0], [2, 0]), floorCount: 3 };
const round2 = { wall: wall([0, 0], [1, 0], [2, 0], [3, 0]), floorCount: 1 };

beforeAll(async () => {
  player = await createTestUser(config, 'azul-sessions');
});

afterAll(async () => {
  await deleteUsers(config, [player]);
});

describe('Azul sessions', () => {
  it('starts in progress, rescores every round and adds end bonuses once finished', async () => {
    const created = await request(app)
      .post('/v1/sessions')
      .set('authorization', bearer())
      .send({
        gameId: 'azul',
        status: 'in_progress',
        state: { rounds: [], finished: false },
        stateVersion: 0,
        scoreTotal: 50,
      });
    expect(created.status).toBe(201);
    const session = SessionSchema.parse(created.body);
    expect(session.scoreTotal).toBe(0);

    const afterTwo = await request(app)
      .patch(`/v1/sessions/${session.id}`)
      .set('authorization', bearer())
      .send({ state: { rounds: [round1, round2], finished: false }, stateVersion: 0 });
    expect(afterTwo.status).toBe(200);
    expect(SessionSchema.parse(afterTwo.body).scoreTotal).toBe(6);

    // A full column (+7) once finished.
    const round3 = { wall: wall([0, 0], [1, 0], [2, 0], [3, 0], [4, 0]), floorCount: 0 };
    const done = await request(app)
      .patch(`/v1/sessions/${session.id}`)
      .set('authorization', bearer())
      .send({
        status: 'completed',
        state: { rounds: [round1, round2, round3], finished: true },
        stateVersion: 0,
      });
    expect(done.status).toBe(200);
    const finished = SessionSchema.parse(done.body);
    // Round 3: a column run of 5, then +7 for the column.
    expect(finished.scoreTotal).toBe(6 + 5 + 7);
    expect(finished.status).toBe('completed');
    expect(finished.breakdown?.categories.map((c) => c.key)).toEqual([
      'round-1',
      'round-2',
      'round-3',
      'rows',
      'columns',
      'colors',
    ]);
  });

  it('AZU-ROUND-2, AZU-ROUND-3: rejects rounds that break the round rules', async () => {
    const twoInRow = await request(app)
      .post('/v1/sessions')
      .set('authorization', bearer())
      .send({
        gameId: 'azul',
        status: 'in_progress',
        state: { rounds: [{ wall: wall([0, 0], [0, 1]), floorCount: 0 }], finished: false },
        stateVersion: 0,
      });
    expect(twoInRow.status).toBe(400);
    expect(errorBody(twoInRow).code).toBe('VALIDATION');

    const removed = await request(app)
      .post('/v1/sessions')
      .set('authorization', bearer())
      .send({
        gameId: 'azul',
        status: 'in_progress',
        state: { rounds: [round2, round1], finished: false },
        stateVersion: 0,
      });
    expect(removed.status).toBe(400);
  });
});
