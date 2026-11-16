import {
  DetectionMetaSchema,
  ScoreBreakdownSchema,
  type DetectionMeta,
  type ScoreBreakdown,
  type SessionStatus,
} from '@tablekeeper/core';

import { requireUserId, type Db } from './client';
import type { PlaySessionsRow } from './types';

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

type DbRow = Pick<
  PlaySessionsRow,
  | 'id'
  | 'game_id'
  | 'status'
  | 'state'
  | 'state_version'
  | 'score_total'
  | 'breakdown'
  | 'detection_meta'
  | 'campaign_id'
  | 'played_at'
>;

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

export async function insertSession(db: Db, write: SessionWrite): Promise<SessionRow> {
  const userId = requireUserId(db);
  const [row] = await db<DbRow>`
    insert into public.play_sessions (
      user_id,
      game_id,
      status,
      state,
      state_version,
      score_total,
      breakdown,
      detection_meta,
      campaign_id,
      played_at
    ) values (
      ${userId},
      ${write.gameId},
      ${write.status},
      ${db.json(write.state)},
      ${write.stateVersion},
      ${write.scoreTotal},
      ${db.json(write.breakdown)},
      ${write.detectionMeta ? db.json(write.detectionMeta) : null},
      ${write.campaignId},
      coalesce(${write.playedAt ?? null}::timestamptz, now())
    )
    returning
      id, game_id, status, state, state_version, score_total,
      breakdown, detection_meta, campaign_id, played_at
  `;
  if (!row) throw new Error('insertSession returned no row');
  return toRow(row);
}

export async function findSession(db: Db, id: string): Promise<SessionRow | null> {
  const userId = requireUserId(db);
  const [row] = await db<DbRow>`
    select
      id, game_id, status, state, state_version, score_total,
      breakdown, detection_meta, campaign_id, played_at
    from public.play_sessions
    where id = ${id} and user_id = ${userId}
  `;
  return row ? toRow(row) : null;
}

export async function updateSession(
  db: Db,
  id: string,
  write: Partial<SessionWrite>,
): Promise<SessionRow | null> {
  const userId = requireUserId(db);
  const [row] = await db<DbRow>`
    update public.play_sessions
    set
      game_id = case when ${write.gameId !== undefined} then ${write.gameId ?? null} else game_id end,
      status = case when ${write.status !== undefined} then ${write.status ?? null} else status end,
      state = case when ${write.state !== undefined} then ${write.state !== undefined ? db.json(write.state) : null} else state end,
      state_version = case when ${write.stateVersion !== undefined} then ${write.stateVersion ?? null} else state_version end,
      score_total = case when ${write.scoreTotal !== undefined} then ${write.scoreTotal ?? null} else score_total end,
      breakdown = case when ${write.breakdown !== undefined} then ${write.breakdown !== undefined ? db.json(write.breakdown) : null} else breakdown end,
      detection_meta = case when ${write.detectionMeta !== undefined} then ${write.detectionMeta ? db.json(write.detectionMeta) : null} else detection_meta end,
      campaign_id = case when ${write.campaignId !== undefined} then ${write.campaignId ?? null} else campaign_id end,
      played_at = case when ${write.playedAt !== undefined} then ${write.playedAt ?? null}::timestamptz else played_at end
    where id = ${id} and user_id = ${userId}
    returning
      id, game_id, status, state, state_version, score_total,
      breakdown, detection_meta, campaign_id, played_at
  `;
  return row ? toRow(row) : null;
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
  const rows = after
    ? await db<DbRow>`
        select
          id, game_id, status, state, state_version, score_total,
          breakdown, detection_meta, campaign_id, played_at
        from public.play_sessions
        where user_id = ${userId}
          and game_id = ${gameId}
          and (
            played_at < ${after.playedAt}::timestamptz
            or (played_at = ${after.playedAt}::timestamptz and id < ${after.id}::uuid)
          )
        order by played_at desc, id desc
        limit ${limit}
      `
    : await db<DbRow>`
        select
          id, game_id, status, state, state_version, score_total,
          breakdown, detection_meta, campaign_id, played_at
        from public.play_sessions
        where user_id = ${userId}
          and game_id = ${gameId}
        order by played_at desc, id desc
        limit ${limit}
      `;
  return rows.map(toRow);
}

/** Scores of every completed session of a game, for personal best and average. */
export async function completedScores(db: Db, userId: string, gameId: string): Promise<number[]> {
  const rows = await db<{ score_total: number }>`
    select score_total
    from public.play_sessions
    where user_id = ${userId}
      and game_id = ${gameId}
      and status = 'completed'
      and score_total is not null
  `;
  return rows.map((row) => row.score_total);
}
