import type { Db } from './client';
import type { Json } from './database.types';

export type CampaignRow = {
  id: string;
  gameId: string;
  state: unknown;
  stateVersion: number;
  archived: boolean;
  updatedAt: string;
};

const COLUMNS = 'id, game_id, state, state_version, archived, updated_at';

type DbRow = {
  id: string;
  game_id: string;
  state: Json;
  state_version: number;
  archived: boolean;
  updated_at: string;
};

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
  const { data, error } = await db
    .from('campaigns')
    .select(COLUMNS)
    .eq('user_id', userId)
    .eq('game_id', gameId)
    .eq('archived', false)
    .maybeSingle();
  if (error) throw error;
  return data ? toRow(data) : null;
}

/** Visible only to its owner (row level security), so another user's id reads as null. */
export async function findCampaignById(db: Db, id: string): Promise<CampaignRow | null> {
  const { data, error } = await db.from('campaigns').select(COLUMNS).eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? toRow(data) : null;
}

export async function insertCampaign(
  db: Db,
  gameId: string,
  state: unknown,
  stateVersion: number,
): Promise<CampaignRow> {
  const { data, error } = await db
    .from('campaigns')
    // Validated by the game's campaign schema, and it arrived as JSON.
    .insert({ game_id: gameId, state: state as NonNullable<Json>, state_version: stateVersion })
    .select(COLUMNS)
    .single();
  if (error) throw error;
  return toRow(data);
}

export async function updateCampaignState(
  db: Db,
  id: string,
  state: unknown,
  stateVersion: number,
): Promise<CampaignRow> {
  const { data, error } = await db
    .from('campaigns')
    .update({ state: state as NonNullable<Json>, state_version: stateVersion })
    .eq('id', id)
    .select(COLUMNS)
    .single();
  if (error) throw error;
  return toRow(data);
}
