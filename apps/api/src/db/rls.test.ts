import { CampaignResponseSchema, CampaignSchema, SessionSchema } from '@tablekeeper/core';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../app';
import { createTestUser, deleteUsers, testConfig, type TestUser } from '../test/helpers';

import { createDb, createUserDb } from './client';
import { ensureProfile } from './profiles';

const config = testConfig();
const service = createDb(config.databaseUrl);
const app = createApp(config);
let a: TestUser;
let b: TestUser;

beforeAll(async () => {
  [a, b] = await Promise.all([
    createTestUser(config, 'x3-rls-a', 'Player A'),
    createTestUser(config, 'x3-rls-b', 'Player B'),
  ]);
  await ensureProfile(createUserDb(service, a.id), a.id, 'Player A');
  await ensureProfile(createUserDb(service, b.id), b.id, 'Player B');
});

afterAll(async () => {
  await deleteUsers(config, [a, b]);
});

describe('row level security at the database', () => {
  it("keeps user A's play_sessions from user B", async () => {
    const dbA = createUserDb(service, a.id);
    const dbB = createUserDb(service, b.id);

    const [inserted] = await dbA<{ id: string; user_id: string }>`
      insert into public.play_sessions (game_id, status, state, state_version, score_total)
      values ('patchwork', 'completed', ${dbA.json({})}, 0, 7)
      returning id, user_id
    `;
    expect(inserted?.user_id).toBe(a.id);
    const id = inserted?.id ?? '';

    expect(await dbA`select id from public.play_sessions where id = ${id}`).toHaveLength(1);
    expect(await dbB`select id from public.play_sessions where id = ${id}`).toEqual([]);

    expect(
      await dbB`update public.play_sessions set score_total = 99 where id = ${id} returning id`,
    ).toEqual([]);
    expect(await dbB`delete from public.play_sessions where id = ${id} returning id`).toEqual([]);

    const [still] = await dbA<{ score_total: number }>`
      select score_total from public.play_sessions where id = ${id}
    `;
    expect(still?.score_total).toBe(7);
  });

  it("won't let a user write a session or profile as someone else", async () => {
    const dbB = createUserDb(service, b.id);
    await expect(
      dbB`
        insert into public.play_sessions (user_id, game_id, status, state, state_version, score_total)
        values (${a.id}, 'patchwork', 'completed', ${dbB.json({})}, 0, 7)
      `,
    ).rejects.toMatchObject({ code: '42501' });

    await expect(
      dbB`insert into public.profiles (id, display_name) values (${a.id}, 'Spoof')`,
    ).rejects.toMatchObject({ code: '42501' });
  });

  it('keeps profiles and campaigns private', async () => {
    const dbA = createUserDb(service, a.id);
    const dbB = createUserDb(service, b.id);

    expect(await dbB`select id from public.profiles where id = ${a.id}`).toEqual([]);
    expect(await dbB`select id from public.profiles where id = ${b.id}`).toHaveLength(1);

    const [campaign] = await dbA<{ id: string }>`
      insert into public.campaigns (game_id, state, state_version)
      values ('dorfromantik', ${dbA.json({})}, 0)
      returning id
    `;
    expect(campaign?.id).toBeDefined();
    expect(await dbB`select id from public.campaigns where id = ${campaign?.id ?? ''}`).toEqual([]);
    expect(
      await dbB`
        update public.campaigns set archived = true where id = ${campaign?.id ?? ''} returning id
      `,
    ).toEqual([]);
  });

  it('gives users and guests no access to the shared tables', async () => {
    const dbA = createUserDb(service, a.id);
    const guest = createUserDb(service, null);

    for (const client of [dbA, guest]) {
      await expect(client`select * from public.rulebooks limit 1`).rejects.toMatchObject({
        code: '42501',
      });
      await expect(client`select * from public.rulebook_sections limit 1`).rejects.toMatchObject({
        code: '42501',
      });
      await expect(client`select * from public.llm_usage limit 1`).rejects.toMatchObject({
        code: '42501',
      });
      await expect(client`select * from public.rate_limit_hits limit 1`).rejects.toMatchObject({
        code: '42501',
      });
    }
    expect(await guest`select id from public.play_sessions`).toEqual([]);
  });
});

describe('cross-user isolation in the API', () => {
  it('blocks reading, updating or linking another user’s session or campaign', async () => {
    const board = { cells: Array.from({ length: 9 }, (_, i) => i < 3) };
    const campaignRes = await request(app)
      .put('/v1/campaigns/_example')
      .set('authorization', `Bearer ${a.token}`)
      .send({ state: { gamesPlayed: 2 }, stateVersion: 1 });
    expect(campaignRes.status).toBe(200);
    const campaign = CampaignSchema.parse(campaignRes.body);

    const sessionRes = await request(app)
      .post('/v1/sessions')
      .set('authorization', `Bearer ${a.token}`)
      .send({
        gameId: '_example',
        status: 'completed',
        state: board,
        stateVersion: 1,
        campaignId: campaign.id,
      });
    expect(sessionRes.status).toBe(201);
    const session = SessionSchema.parse(sessionRes.body);

    // User B cannot read or update User A's session.
    const readSession = await request(app)
      .get(`/v1/sessions/${session.id}`)
      .set('authorization', `Bearer ${b.token}`);
    expect(readSession.status).toBe(404);

    const patchSession = await request(app)
      .patch(`/v1/sessions/${session.id}`)
      .set('authorization', `Bearer ${b.token}`)
      .send({ status: 'in_progress' });
    expect(patchSession.status).toBe(404);

    // User B cannot link User A's campaign or see it as their active campaign.
    const hijackCampaign = await request(app)
      .post('/v1/sessions')
      .set('authorization', `Bearer ${b.token}`)
      .send({
        gameId: '_example',
        status: 'completed',
        state: board,
        stateVersion: 1,
        campaignId: campaign.id,
      });
    expect(hijackCampaign.status).toBe(404);

    const bCampaign = await request(app)
      .get('/v1/campaigns/_example')
      .set('authorization', `Bearer ${b.token}`);
    expect(CampaignResponseSchema.parse(bCampaign.body)).toEqual({ campaign: null });
  });
});
