import {
  DetectionMetaSchema,
  ScoreBreakdownSchema,
  type DetectionMeta,
  type ScoreBreakdown,
  type SessionStatus,
} from '@tablekeeper/core';

import type { Db } from './client';
import type { Json } from './database.types';

/** A stored session in camelCase; `gameId` is unchecked text, the service resolves it. */
export type SessionRow = {
  id: string;
  gameId: string;
  status: SessionStatus;
  state: unknown;
  stateVersion: number;
  scoreTotal: number | null;
  breakdown: ScoreBreakdown | null;
  detectionMeta: DetectionMeta | null;
  campaignId: string | null;
  /** As stored (microsecond precision), so cursors compare exactly. */
  playedAt: string;
};

export type SessionWrite = {
  gameId: string;
  status: SessionStatus;
  state: unknown;
  stateVersion: number;
  scoreTotal: number;
  breakdown: ScoreBreakdown;
  detectionMeta: DetectionMeta | null;
  campaignId: string | null;
  playedAt?: string;
};

const COLUMNS =
  'id, game_id, status, state, state_version, score_total, breakdown, detection_meta, campaign_id, played_at';

type DbRow = {
  id: string;
  game_id: string;
  status: string;
  state: Json;
  state_version: number;
  score_total: number | null;
  breakdown: Json | null;
  detection_meta: Json | null;
  campaign_id: string | null;
  played_at: string;
};

// Stored JSON is validated on the way out; anything malformed reads as missing.
function toRow(row: DbRow): SessionRow {
  const breakdown = ScoreBreakdownSchema.safeParse(row.breakdown);
  const meta = DetectionMetaSchema.safeParse(row.detection_meta);
  return {
    id: row.id,
    gameId: row.game_id,
    status: row.status === 'completed' ? 'completed' : 'in_progress',
    state: row.state,
    stateVersion: row.state_version,
    scoreTotal: row.score_total,
    breakdown: breakdown.success ? breakdown.data : null,
    detectionMeta: meta.success ? meta.data : null,
    campaignId: row.campaign_id,
    playedAt: row.played_at,
  };
}

function toDb(write: Partial<SessionWrite>) {
  return {
    ...(write.gameId === undefined ? {} : { game_id: write.gameId }),
    ...(write.status === undefined ? {} : { status: write.status }),
    // Request bodies arrive as JSON, so state is JSON already.
    ...(write.state === undefined ? {} : { state: write.state as NonNullable<Json> }),
    ...(write.stateVersion === undefined ? {} : { state_version: write.stateVersion }),
    ...(write.scoreTotal === undefined ? {} : { score_total: write.scoreTotal }),
    ...(write.breakdown === undefined ? {} : { breakdown: write.breakdown as unknown as Json }),
    ...(write.detectionMeta === undefined
      ? {}
      : { detection_meta: write.detectionMeta as unknown as Json }),
    ...(write.campaignId === undefined ? {} : { campaign_id: write.campaignId }),
    ...(write.playedAt === undefined ? {} : { played_at: write.playedAt }),
  };
}

export async function insertSession(db: Db, write: SessionWrite): Promise<SessionRow> {
  const { data, error } = await db
    .from('play_sessions')
    .insert({
      ...toDb(write),
      game_id: write.gameId,
      status: write.status,
      state: write.state as NonNullable<Json>,
      state_version: write.stateVersion,
    })
    .select(COLUMNS)
    .single();
  if (error) throw error;
  return toRow(data);
}

export async function findSession(db: Db, id: string): Promise<SessionRow | null> {
  const { data, error } = await db.from('play_sessions').select(COLUMNS).eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? toRow(data) : null;
}

export async function updateSession(
  db: Db,
  id: string,
  write: Partial<SessionWrite>,
): Promise<SessionRow | null> {
  const { data, error } = await db
    .from('play_sessions')
    .update(toDb(write))
    .eq('id', id)
    .select(COLUMNS)
    .maybeSingle();
  if (error) throw error;
  return data ? toRow(data) : null;
}

export type SessionCursor = { playedAt: string; id: string };

/** One page of a user's sessions of a game, newest first; `limit + 1` rows tell if more follow. */
export async function listSessions(
  db: Db,
  userId: string,
  gameId: string,
  limit: number,
  after?: SessionCursor,
): Promise<SessionRow[]> {
  let query = db
    .from('play_sessions')
    .select(COLUMNS)
    .eq('user_id', userId)
    .eq('game_id', gameId)
    .order('played_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit);
  if (after) {
    const at = JSON.stringify(after.playedAt);
    query = query.or(`played_at.lt.${at},and(played_at.eq.${at},id.lt.${after.id})`);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data.map(toRow);
}

/** Scores of every completed session of a game, for personal best and average. */
export async function completedScores(db: Db, userId: string, gameId: string): Promise<number[]> {
  const { data, error } = await db
    .from('play_sessions')
    .select('score_total')
    .eq('user_id', userId)
    .eq('game_id', gameId)
    .eq('status', 'completed')
    .not('score_total', 'is', null);
  if (error) throw error;
  return data.map((row) => row.score_total);
}
