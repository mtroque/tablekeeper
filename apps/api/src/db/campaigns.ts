import { requireUserId, type Db } from './client';
import type { CampaignsRow } from './types';

export type CampaignRow = {
  id: string;
  gameId: string;
  state: unknown;
  stateVersion: number;
  archived: boolean;
  updatedAt: string;
};

type DbRow = Pick<
  CampaignsRow,
  'id' | 'game_id' | 'state' | 'state_version' | 'archived' | 'updated_at'
>;

function toRow(row: DbRow): CampaignRow {
  return {
    id: row.id,
    gameId: row.game_id,
    state: row.state,
    stateVersion: row.state_version,
    archived: row.archived,
    updatedAt: row.updated_at,
  };
}

/** The user's one active (not archived) campaign for a game. */
export async function findActiveCampaign(
  db: Db,
  userId: string,
  gameId: string,
): Promise<CampaignRow | null> {
  const [row] = await db<DbRow>`
    select id, game_id, state, state_version, archived, updated_at
    from public.campaigns
    where user_id = ${userId} and game_id = ${gameId} and not archived
  `;
  return row ? toRow(row) : null;
}

/** Filtered by the caller's user_id and backed up by RLS, so another user's id reads as null. */
export async function findCampaignById(db: Db, id: string): Promise<CampaignRow | null> {
  const userId = requireUserId(db);
  const [row] = await db<DbRow>`
    select id, game_id, state, state_version, archived, updated_at
    from public.campaigns
    where id = ${id} and user_id = ${userId}
  `;
  return row ? toRow(row) : null;
}

export async function insertCampaign(
  db: Db,
  gameId: string,
  state: unknown,
  stateVersion: number,
): Promise<CampaignRow> {
  const userId = requireUserId(db);
  const [row] = await db<DbRow>`
    insert into public.campaigns (user_id, game_id, state, state_version)
    values (${userId}, ${gameId}, ${db.json(state)}, ${stateVersion})
    returning id, game_id, state, state_version, archived, updated_at
  `;
  if (!row) throw new Error('insertCampaign returned no row');
  return toRow(row);
}

export async function updateCampaignState(
  db: Db,
  id: string,
  state: unknown,
  stateVersion: number,
): Promise<CampaignRow> {
  const userId = requireUserId(db);
  const [row] = await db<DbRow>`
    update public.campaigns
    set state = ${db.json(state)}, state_version = ${stateVersion}
    where id = ${id} and user_id = ${userId}
    returning id, game_id, state, state_version, archived, updated_at
  `;
  if (!row) throw new Error('updateCampaignState returned no row');
  return toRow(row);
}

/** Archives the caller's active campaign for the game and inserts this one, in one transaction. */
export async function startCampaign(
  db: Db,
  gameId: string,
  state: unknown,
  stateVersion: number,
): Promise<CampaignRow> {
  const [row] = await db<DbRow>`
    select id, game_id, state, state_version, archived, updated_at
    from public.start_campaign(${gameId}, ${db.json(state)}, ${stateVersion})
  `;
  if (!row) throw new Error('start_campaign returned no row');
  return toRow(row);
}
