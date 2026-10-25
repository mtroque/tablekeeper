import { createClient } from '@supabase/supabase-js';
import {
  CampaignResponseSchema,
  CampaignSchema,
  GAMES,
  SessionPageSchema,
  SessionSchema,
} from '@tablekeeper/core';
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
let alice: TestUser;
let bob: TestUser;

const bearer = (user: TestUser) => `Bearer ${user.token}`;
const board = (covered: number) => ({ cells: Array.from({ length: 9 }, (_, i) => i < covered) });
const save = (user: TestUser, body: object) =>
  request(app).post('/v1/sessions').set('authorization', bearer(user)).send(body);

beforeAll(async () => {
  [alice, bob] = await Promise.all([
    createTestUser(config, 's1-sessions-a'),
    createTestUser(config, 's1-sessions-b'),
  ]);
});

afterAll(async () => {
  await deleteUsers(config, [alice, bob]);
});

describe('POST /v1/sessions', () => {
  it('ignores a tampered score and stores the recomputed one', async () => {
    const res = await save(alice, {
      gameId: '_example',
      status: 'completed',
      state: board(4),
      stateVersion: 1,
      scoreTotal: 999,
      breakdown: { total: 999, categories: [] },
    });
    expect(res.status).toBe(201);
    const session = SessionSchema.parse(res.body);
    expect(session.scoreTotal).toBe(4);
    expect(session.breakdown?.total).toBe(4);

    const stored = await admin
      .from('play_sessions')
      .select('score_total, user_id')
      .eq('id', session.id)
      .single();
    expect(stored.data).toEqual({ score_total: 4, user_id: alice.id });
  });

  it('keeps detection meta', async () => {
    const meta = { corrected: ['0,1'], detected: 9 };
    const res = await save(alice, {
      gameId: '_example',
      status: 'in_progress',
      state: board(1),
      stateVersion: 1,
      detectionMeta: meta,
    });
    expect(SessionSchema.parse(res.body).detectionMeta).toEqual(meta);
  });

  it('answers NOT_FOUND for an unknown game', async () => {
    const res = await save(alice, {
      gameId: 'chess',
      status: 'completed',
      state: {},
      stateVersion: 0,
    });
    expect(res.status).toBe(404);
    expect(errorBody(res).code).toBe('NOT_FOUND');
  });

  // Real games get their scorers in their own slices; skipped once every game has one.
  const unscored = GAMES.find((game) => !game.score);
  it.skipIf(!unscored)('answers 422 for a game without a scorer yet', async () => {
    const res = await save(alice, {
      gameId: unscored?.id,
      status: 'completed',
      state: null,
      stateVersion: 0,
    });
    expect(res.status).toBe(422);
    expect(errorBody(res).code).toBe('VALIDATION');
  });

  it('rejects invalid state with its issues', async () => {
    const res = await save(alice, {
      gameId: '_example',
      status: 'completed',
      state: { cells: [true] },
      stateVersion: 1,
    });
    expect(res.status).toBe(400);
    expect(errorBody(res).details).toMatchObject({ issues: [{ path: 'cells' }] });
  });

  it('rejects a campaign that belongs to someone else', async () => {
    const put = await request(app)
      .put('/v1/campaigns/_example')
      .set('authorization', bearer(bob))
      .send({ state: { gamesPlayed: 1 }, stateVersion: 1 });
    const bobsCampaign = CampaignSchema.parse(put.body);
    const res = await save(alice, {
      gameId: '_example',
      status: 'completed',
      state: board(1),
      stateVersion: 1,
      campaignId: bobsCampaign.id,
    });
    expect(res.status).toBe(404);
  });

  it('needs sign-in', async () => {
    const res = await request(app)
      .post('/v1/sessions')
      .send({ gameId: '_example', status: 'completed', state: board(1), stateVersion: 1 });
    expect(res.status).toBe(401);
  });
});

describe('GET and PATCH /v1/sessions/:id', () => {
  it('reads your own session and hides other users’ sessions', async () => {
    const created = SessionSchema.parse(
      (
        await save(alice, {
          gameId: '_example',
          status: 'completed',
          state: board(2),
          stateVersion: 1,
        })
      ).body,
    );
    const mine = await request(app)
      .get(`/v1/sessions/${created.id}`)
      .set('authorization', bearer(alice));
    expect(SessionSchema.parse(mine.body)).toEqual(created);

    const theirs = await request(app)
      .get(`/v1/sessions/${created.id}`)
      .set('authorization', bearer(bob));
    expect(theirs.status).toBe(404);
    const patch = await request(app)
      .patch(`/v1/sessions/${created.id}`)
      .set('authorization', bearer(bob))
      .send({ status: 'in_progress' });
    expect(patch.status).toBe(404);
  });

  it('rescores on update and ignores a sent total', async () => {
    const created = SessionSchema.parse(
      (
        await save(alice, {
          gameId: '_example',
          status: 'in_progress',
          state: board(1),
          stateVersion: 1,
        })
      ).body,
    );
    const res = await request(app)
      .patch(`/v1/sessions/${created.id}`)
      .set('authorization', bearer(alice))
      .send({ status: 'completed', state: board(7), stateVersion: 1, scoreTotal: 0 });
    expect(res.status).toBe(200);
    expect(SessionSchema.parse(res.body)).toMatchObject({ status: 'completed', scoreTotal: 7 });
  });
});

describe('GET /v1/sessions', () => {
  it('pages history newest first with personal best and average over completed games', async () => {
    const user = await createTestUser(config, 's1-sessions-history');
    try {
      // 22 completed games scoring 0 to 8 in turn, one a minute, plus one in progress.
      const start = Date.parse('2026-01-01T12:00:00.000Z');
      const scores: number[] = [];
      for (let i = 0; i < 22; i++) {
        const covered = i % 9;
        scores.push(covered);
        const res = await save(user, {
          gameId: '_example',
          status: 'completed',
          state: board(covered),
          stateVersion: 1,
          playedAt: new Date(start + i * 60_000).toISOString(),
        });
        expect(res.status).toBe(201);
      }
      await save(user, {
        gameId: '_example',
        status: 'in_progress',
        state: board(9),
        stateVersion: 1,
      });

      const first = SessionPageSchema.parse(
        (await request(app).get('/v1/sessions?gameId=_example').set('authorization', bearer(user)))
          .body,
      );
      expect(first.items).toHaveLength(20);
      expect(first.items[0]?.status).toBe('in_progress');
      expect(first.items[1]?.playedAt).toBe(new Date(start + 21 * 60_000).toISOString());
      expect(first.best).toBe(8);
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      expect(first.average).toBeCloseTo(avg, 1);
      expect(first.nextCursor).not.toBeNull();

      const second = SessionPageSchema.parse(
        (
          await request(app)
            .get(`/v1/sessions?gameId=_example&cursor=${first.nextCursor ?? ''}`)
            .set('authorization', bearer(user))
        ).body,
      );
      expect(second.items).toHaveLength(3);
      expect(second.nextCursor).toBeNull();
      const ids = new Set([...first.items, ...second.items].map((item) => item.id));
      expect(ids.size).toBe(23);
    } finally {
      await deleteUsers(config, [user]);
    }
  });

  it('answers NOT_FOUND for an unknown game and VALIDATION for a bad cursor', async () => {
    const unknown = await request(app)
      .get('/v1/sessions?gameId=chess')
      .set('authorization', bearer(alice));
    expect(unknown.status).toBe(404);
    const bad = await request(app)
      .get('/v1/sessions?gameId=_example&cursor=nope')
      .set('authorization', bearer(alice));
    expect(bad.status).toBe(400);
  });
});

describe('/v1/campaigns/:gameId', () => {
  it('starts empty, saves validated state and updates the same campaign', async () => {
    const empty = await request(app)
      .get('/v1/campaigns/_example')
      .set('authorization', bearer(alice));
    expect(CampaignResponseSchema.parse(empty.body)).toEqual({ campaign: null });

    const invalid = await request(app)
      .put('/v1/campaigns/_example')
      .set('authorization', bearer(alice))
      .send({ state: { gamesPlayed: -1 }, stateVersion: 1 });
    expect(invalid.status).toBe(400);

    const first = CampaignSchema.parse(
      (
        await request(app)
          .put('/v1/campaigns/_example')
          .set('authorization', bearer(alice))
          .send({ state: { gamesPlayed: 1 }, stateVersion: 1 })
      ).body,
    );
    const second = CampaignSchema.parse(
      (
        await request(app)
          .put('/v1/campaigns/_example')
          .set('authorization', bearer(alice))
          .send({ state: { gamesPlayed: 2 }, stateVersion: 1 })
      ).body,
    );
    expect(second.id).toBe(first.id);
    const read = await request(app)
      .get('/v1/campaigns/_example')
      .set('authorization', bearer(alice));
    expect(CampaignResponseSchema.parse(read.body).campaign?.state).toEqual({ gamesPlayed: 2 });
  });

  it('answers 422 for a game without a campaign and 404 for an unknown one', async () => {
    const none = await request(app)
      .get('/v1/campaigns/patchwork')
      .set('authorization', bearer(alice));
    expect(none.status).toBe(422);
    const unknown = await request(app)
      .get('/v1/campaigns/chess')
      .set('authorization', bearer(alice));
    expect(unknown.status).toBe(404);
  });
});
