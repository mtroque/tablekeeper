import {
  CampaignResponseSchema,
  CampaignSchema,
  SessionPageSchema,
  SessionSchema,
  type Campaign,
  type GameId,
  type Session,
  type SessionInput,
} from '@tablekeeper/core';

import type { ApiClient } from '@/lib/api-client';

import type { SessionPage, SessionStore } from './session-store';

/** Signed in: everything goes through the API, which recomputes scores. */
export class ApiStore implements SessionStore {
  constructor(private readonly client: ApiClient) {}

  list(gameId: GameId, cursor?: string): Promise<SessionPage> {
    const query = new URLSearchParams({ gameId, ...(cursor ? { cursor } : {}) });
    return this.client.request(`/v1/sessions?${query.toString()}`, { schema: SessionPageSchema });
  }

  async get(id: string): Promise<Session | null> {
    try {
      return await this.client.request(`/v1/sessions/${encodeURIComponent(id)}`, {
        schema: SessionSchema,
      });
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'NOT_FOUND') return null;
      throw error;
    }
  }

  save(input: SessionInput, id?: string): Promise<Session> {
    if (id) {
      return this.client.request(`/v1/sessions/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: {
          status: input.status,
          state: input.state,
          stateVersion: input.stateVersion,
          ...(input.detectionMeta ? { detectionMeta: input.detectionMeta } : {}),
        },
        schema: SessionSchema,
      });
    }
    return this.client.request('/v1/sessions', {
      method: 'POST',
      body: input,
      schema: SessionSchema,
    });
  }

  async getCampaign(gameId: GameId): Promise<Campaign | null> {
    const res = await this.client.request(`/v1/campaigns/${encodeURIComponent(gameId)}`, {
      schema: CampaignResponseSchema,
    });
    return res.campaign;
  }

  saveCampaign(gameId: GameId, state: unknown, stateVersion: number): Promise<Campaign> {
    return this.client.request(`/v1/campaigns/${encodeURIComponent(gameId)}`, {
      method: 'PUT',
      body: { state, stateVersion },
      schema: CampaignSchema,
    });
  }
}
