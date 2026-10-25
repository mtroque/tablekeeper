import {
  blankSheet,
  CampaignResponseSchema,
  CampaignSchema,
  DorfromantikCampaignSchema,
  initialCampaign,
  recordGame,
  SessionPageSchema,
  SessionSchema,
} from '@tablekeeper/core';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../app';
import { createTestUser, deleteUsers, testConfig, type TestUser } from '../test/helpers';

const config = testConfig();
const app = createApp(config);
let player: TestUser;

const bearer = () => `Bearer ${player.token}`;

/** The rulebook example (docs/games/dorfromantik.md → Worked examples): 60 points. */
const rulebookExample = {
  ...blankSheet(initialCampaign()),
  tasks: { forest: 10, grain: 6, village: 12, track: 4, stream: 10 },
  flags: { green: 0, yellow: 5, red: 0 },
  longest: { track: 8, stream: 5 },
};

beforeAll(async () => {
  player = await createTestUser(config, 'dorfromantik-api');
});

afterAll(async () => {
  await deleteUsers(config, [player]);
});

describe('dorfromantik sessions and campaign', () => {
  it('saves a scored game linked to the campaign and raises its game count', async () => {
    const created = await request(app)
      .put('/v1/campaigns/dorfromantik')
      .set('authorization', bearer())
      .send({ state: { ...initialCampaign(), unlocked: ['DOR-U-CIRCUS'] }, stateVersion: 0 });
    expect(created.status).toBe(200);
    const campaign = CampaignSchema.parse(created.body);

    const saved = await request(app)
      .post('/v1/sessions')
      .set('authorization', bearer())
      .send({
        gameId: 'dorfromantik',
        status: 'completed',
        state: { ...rulebookExample, extras: { 'DOR-E-CIRCUS': true } },
        stateVersion: 0,
        campaignId: campaign.id,
        scoreTotal: 999,
      });
    expect(saved.status).toBe(201);
    const session = SessionSchema.parse(saved.body);
    expect(session.scoreTotal).toBe(70);
    expect(session.campaignId).toBe(campaign.id);

    const state = DorfromantikCampaignSchema.parse(campaign.state);
    const updated = await request(app)
      .put('/v1/campaigns/dorfromantik')
      .set('authorization', bearer())
      .send({
        state: recordGame(state, { sessionId: session.id, gameNumber: 1, total: 70 }),
        stateVersion: 0,
      });
    expect(updated.status).toBe(200);

    const read = await request(app)
      .get('/v1/campaigns/dorfromantik')
      .set('authorization', bearer());
    const active = CampaignResponseSchema.parse(read.body).campaign;
    expect(active?.id).toBe(campaign.id);
    expect(DorfromantikCampaignSchema.parse(active?.state).games).toHaveLength(1);

    const history = await request(app)
      .get('/v1/sessions?gameId=dorfromantik')
      .set('authorization', bearer());
    expect(SessionPageSchema.parse(history.body).items.map((item) => item.id)).toEqual([
      session.id,
    ]);
  });

  it('rejects a sheet with a negative count and a campaign with four hearts', async () => {
    const sheet = await request(app)
      .post('/v1/sessions')
      .set('authorization', bearer())
      .send({
        gameId: 'dorfromantik',
        status: 'completed',
        state: { ...rulebookExample, longest: { track: -1, stream: 0 } },
        stateVersion: 0,
      });
    expect(sheet.status).toBe(400);

    const hearts = await request(app)
      .put('/v1/campaigns/dorfromantik')
      .set('authorization', bearer())
      .send({
        state: { ...initialCampaign(), unlocked: ['DOR-U-REDHEART'], redHearts: 4 },
        stateVersion: 0,
      });
    expect(hearts.status).toBe(400);
  });
});
