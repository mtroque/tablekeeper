import { describe, expect, it } from 'vitest';

import { CampaignResponseSchema, PutCampaignRequestSchema } from './campaigns';
import {
  ListSessionsQuerySchema,
  PatchSessionRequestSchema,
  SaveSessionRequestSchema,
  SessionPageSchema,
  SessionSchema,
} from './sessions';

const id = '6f1c7a8e-3c1e-4d4f-9b7a-2d1f0e9c8b7a';

describe('session contracts', () => {
  it('drops a client-sent score from a save request', () => {
    const body = SaveSessionRequestSchema.parse({
      gameId: 'patchwork',
      status: 'completed',
      state: { anything: true },
      stateVersion: 1,
      scoreTotal: 999,
      breakdown: { total: 999, categories: [] },
    });
    expect(body).not.toHaveProperty('scoreTotal');
    expect(body).not.toHaveProperty('breakdown');
  });

  it('accepts any well-formed game id in requests, so unknown games are a lookup miss', () => {
    expect(ListSessionsQuerySchema.safeParse({ gameId: 'chess' }).success).toBe(true);
    expect(ListSessionsQuerySchema.safeParse({ gameId: 'Not An Id' }).success).toBe(false);
  });

  it('requires state and stateVersion together on patch, and something to change', () => {
    expect(PatchSessionRequestSchema.safeParse({ status: 'completed' }).success).toBe(true);
    expect(PatchSessionRequestSchema.safeParse({ state: {} }).success).toBe(false);
    expect(PatchSessionRequestSchema.safeParse({}).success).toBe(false);
  });

  it('parses a session and a page of history', () => {
    const session = {
      id,
      gameId: 'harmonies',
      status: 'completed',
      state: {},
      stateVersion: 1,
      scoreTotal: 36,
      breakdown: {
        total: 36,
        categories: [
          { key: 'water', label: 'Water', points: 15, highlights: [{ kind: 'hex', q: 0, r: 1 }] },
        ],
      },
      detectionMeta: { corrected: ['0,1'], detected: 23 },
      campaignId: null,
      playedAt: '2026-10-25T18:00:00.000Z',
    };
    expect(SessionSchema.parse(session)).toEqual(session);
    expect(SessionSchema.safeParse({ ...session, gameId: 'chess' }).success).toBe(false);
    const page = { items: [], nextCursor: null, best: null, average: null };
    expect(SessionPageSchema.parse(page)).toEqual(page);
  });
});

describe('campaign contracts', () => {
  it('allows no campaign yet and requires a state version on put', () => {
    expect(CampaignResponseSchema.parse({ campaign: null })).toEqual({ campaign: null });
    expect(PutCampaignRequestSchema.safeParse({ state: {} }).success).toBe(false);
  });
});
