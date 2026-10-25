import {
  CampaignSchema,
  getGame,
  parseState,
  SessionSchema,
  type Campaign,
  type GameId,
  type Session,
  type SessionInput,
} from '@tablekeeper/core';
import type { z } from 'zod';

import type { SessionPage, SessionStore } from './session-store';

/** Key-value storage; `localStorage` in the browser, a map in tests. */
export type KeyValue = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const PREFIX = 'tk:v1:';
const sessionKey = (id: string) => `${PREFIX}session:${id}`;
const campaignKey = (gameId: string) => `${PREFIX}campaign:${gameId}`;

/**
 * Guests: only this device. Guests have no history (docs/PRODUCT.md → Guests and accounts),
 * so `list` is always empty and only in-progress sessions and campaigns are kept.
 */
export class LocalStore implements SessionStore {
  constructor(
    private readonly storage: KeyValue,
    private readonly newId: () => string = () => crypto.randomUUID(),
  ) {}

  private read<T>(key: string, schema: z.ZodType<T>): T | null {
    let raw: string | null = null;
    try {
      raw = this.storage.getItem(key);
    } catch {
      return null;
    }
    if (raw === null) return null;
    try {
      const parsed = schema.safeParse(JSON.parse(raw));
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  }

  list(): Promise<SessionPage> {
    return Promise.resolve({ items: [], nextCursor: null, best: null, average: null });
  }

  get(id: string): Promise<Session | null> {
    return Promise.resolve(this.read(sessionKey(id), SessionSchema));
  }

  save(input: SessionInput, id?: string): Promise<Session> {
    const game = getGame(input.gameId);
    if (!game) return Promise.reject(new Error(`Unknown game ${input.gameId}`));
    const parsed = parseState(game, input.state, input.stateVersion);
    if (!parsed.ok) return Promise.reject(new Error(parsed.error.message));
    const breakdown = game.score?.(parsed.value) ?? null;
    const session: Session = {
      id: id ?? this.newId(),
      gameId: game.id,
      status: input.status,
      state: parsed.value,
      stateVersion: game.stateVersion,
      scoreTotal: breakdown?.total ?? null,
      breakdown,
      detectionMeta: input.detectionMeta ?? null,
      campaignId: input.campaignId ?? null,
      playedAt: input.playedAt ?? new Date().toISOString(),
    };
    if (session.status === 'in_progress') {
      this.storage.setItem(sessionKey(session.id), JSON.stringify(session));
    } else {
      this.storage.removeItem(sessionKey(session.id));
    }
    return Promise.resolve(session);
  }

  getCampaign(gameId: GameId): Promise<Campaign | null> {
    return Promise.resolve(this.read(campaignKey(gameId), CampaignSchema));
  }

  saveCampaign(gameId: GameId, state: unknown, stateVersion: number): Promise<Campaign> {
    const game = getGame(gameId);
    const parsed = game?.campaign?.schema.safeParse(state);
    if (!parsed?.success) return Promise.reject(new Error('The campaign is invalid.'));
    const campaign: Campaign = {
      id: this.read(campaignKey(gameId), CampaignSchema)?.id ?? this.newId(),
      gameId,
      state: parsed.data,
      stateVersion,
      archived: false,
      updatedAt: new Date().toISOString(),
    };
    this.storage.setItem(campaignKey(gameId), JSON.stringify(campaign));
    return Promise.resolve(campaign);
  }
}
