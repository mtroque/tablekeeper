import type { Campaign, GameId, Session, SessionInput, SessionSummary } from '@tablekeeper/core';

export type SessionPage = {
  items: SessionSummary[];
  /** Pass to `list` for the next page; null on the last page. */
  nextCursor: string | null;
  best: number | null;
  average: number | null;
};

/**
 * The only way the UI persists anything (docs/ARCHITECTURE.md → Client state and storage):
 * `LocalStore` for guests, `ApiStore` when signed in. Components never know which.
 */
export interface SessionStore {
  list(gameId: GameId, cursor?: string): Promise<SessionPage>;
  get(id: string): Promise<Session | null>;
  save(input: SessionInput, id?: string): Promise<Session>;
  getCampaign(gameId: GameId): Promise<Campaign | null>;
  saveCampaign(gameId: GameId, state: unknown, stateVersion: number): Promise<Campaign>;
}
