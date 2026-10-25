import { createClient } from '@supabase/supabase-js';
import { initialPatchworkState, SessionSchema, type PatchworkState } from '@tablekeeper/core';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../app';
import type { Database } from '../db/database.types';
import { createTestUser, deleteUsers, errorBody, testConfig, type TestUser } from '../test/helpers';

const config = testConfig();
const app = createApp(config);
const admin = createClient<Database>(config.supabase.url, config.supabase.serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
let player: TestUser;

/** The rulebook's Scoring example: 5 empty spaces, 14 pralines, special tile: 11 points. */
const rulebookExample: PatchworkState = {
  ...initialPatchworkState(),
  board: 'gray',
  grid: Array.from({ length: 81 }, (_, i) => i >= 5),
  tokens: { one: 4, five: 0, ten: 1, twenty: 0 },
  specialTile: true,
};

const save = (body: object) =>
  request(app).post('/v1/sessions').set('authorization', `Bearer ${player.token}`).send(body);

beforeAll(async () => {
  player = await createTestUser(config, 'patchwork-sessions');
});

afterAll(async () => {
  await deleteUsers(config, [player]);
});

describe('patchwork sessions', () => {
  it('recomputes the score and ignores a tampered total', async () => {
    const res = await save({
      gameId: 'patchwork',
      status: 'completed',
      state: rulebookExample,
      stateVersion: 1,
      scoreTotal: 500,
    });
    expect(res.status).toBe(201);
    const session = SessionSchema.parse(res.body);
    expect(session.scoreTotal).toBe(11);
    expect(session.breakdown?.categories.map((row) => [row.key, row.points])).toEqual([
      ['pralines', 14],
      ['specialTile', 7],
      ['emptySpaces', -10],
    ]);
    expect(session.state).toEqual(rulebookExample);

    const stored = await admin
      .from('play_sessions')
      .select('score_total, state_version')
      .eq('id', session.id)
      .single();
    expect(stored.data).toEqual({ score_total: 11, state_version: 1 });
  });

  it('rejects a box board that is not 81 spaces', async () => {
    const res = await save({
      gameId: 'patchwork',
      status: 'completed',
      state: { ...rulebookExample, grid: rulebookExample.grid.slice(1) },
      stateVersion: 1,
    });
    expect(res.status).toBe(400);
    expect(errorBody(res).code).toBe('VALIDATION');
    expect(errorBody(res).details).toMatchObject({ issues: [{ path: 'grid' }] });
  });
});
