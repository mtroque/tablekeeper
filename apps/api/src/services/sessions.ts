import {
  getGame,
  parseState,
  SESSION_PAGE_SIZE,
  type GameDefinition,
  type PatchSessionRequest,
  type SaveSessionRequest,
  type ScoreBreakdown,
  type Session,
  type SessionPage,
  type StateError,
} from '@tablekeeper/core';
import { z } from 'zod';

import { findCampaignById } from '../db/campaigns';
import {
  completedScores,
  findSession,
  insertSession,
  listSessions as listSessionRows,
  updateSession,
  type SessionCursor,
  type SessionRow,
} from '../db/sessions';
import { AppError, notFound } from '../errors';
import type { AuthContext } from '../types/express';

/** The registered game, or `NOT_FOUND`. */
export function requireGame(gameId: string): GameDefinition {
  const game = getGame(gameId);
  if (!game) throw notFound('That game');
  return game;
}

type ScorableGame = GameDefinition & { score: NonNullable<GameDefinition['score']> };

/** A game that can be scored, or 422 until its slice adds a scorer. */
function requireScorer(gameId: string): ScorableGame {
  const game = requireGame(gameId);
  const { score } = game;
  if (!score) throw new AppError('VALIDATION', 422, `${game.name} can't be scored yet.`);
  return { ...game, score };
}

function invalidState(error: StateError): AppError {
  return new AppError(
    'VALIDATION',
    400,
    'The board state is invalid.',
    error.kind === 'invalid' ? { issues: error.issues } : undefined,
  );
}

/** Upgrades and validates sent state, then recomputes the score: the client's is never used. */
function scoreState(
  game: ScorableGame,
  raw: unknown,
  fromVersion: number,
): { state: unknown; breakdown: ScoreBreakdown } {
  const parsed = parseState(game, raw, fromVersion);
  if (!parsed.ok) throw invalidState(parsed.error);
  return { state: parsed.value, breakdown: game.score(parsed.value) };
}

function toSession(game: GameDefinition, row: SessionRow): Session {
  // Stored state is upgraded on read; if it no longer parses it's returned as stored.
  const parsed = parseState(game, row.state, row.stateVersion);
  return {
    id: row.id,
    gameId: game.id,
    status: row.status,
    state: parsed.ok ? parsed.value : row.state,
    stateVersion: parsed.ok ? game.stateVersion : row.stateVersion,
    scoreTotal: row.scoreTotal,
    breakdown: row.breakdown,
    detectionMeta: row.detectionMeta,
    campaignId: row.campaignId,
    playedAt: new Date(row.playedAt).toISOString(),
  };
}

async function requireOwnCampaign(auth: AuthContext, campaignId: string | undefined) {
  if (campaignId === undefined) return;
  if (!(await findCampaignById(auth.db, campaignId))) throw notFound('That campaign');
}

export async function saveSession(auth: AuthContext, body: SaveSessionRequest): Promise<Session> {
  const game = requireScorer(body.gameId);
  const { state, breakdown } = scoreState(game, body.state, body.stateVersion);
  await requireOwnCampaign(auth, body.campaignId);
  const row = await insertSession(auth.db, {
    gameId: game.id,
    status: body.status,
    state,
    stateVersion: game.stateVersion,
    scoreTotal: breakdown.total,
    breakdown,
    detectionMeta: body.detectionMeta ?? null,
    campaignId: body.campaignId ?? null,
    ...(body.playedAt ? { playedAt: body.playedAt } : {}),
  });
  return toSession(game, row);
}

async function requireSession(auth: AuthContext, id: string): Promise<SessionRow> {
  // Row level security hides other users' sessions, so theirs are `NOT_FOUND` too.
  const row = await findSession(auth.db, id);
  if (!row) throw notFound('That game');
  return row;
}

export async function getSession(auth: AuthContext, id: string): Promise<Session> {
  const row = await requireSession(auth, id);
  return toSession(requireGame(row.gameId), row);
}

export async function patchSession(
  auth: AuthContext,
  id: string,
  body: PatchSessionRequest,
): Promise<Session> {
  const existing = await requireSession(auth, id);
  const game = requireScorer(existing.gameId);
  // Every update rescores, from the new state or the stored one.
  const { state, breakdown } =
    body.state !== undefined && body.stateVersion !== undefined
      ? scoreState(game, body.state, body.stateVersion)
      : scoreState(game, existing.state, existing.stateVersion);
  const row = await updateSession(auth.db, id, {
    state,
    stateVersion: game.stateVersion,
    scoreTotal: breakdown.total,
    breakdown,
    ...(body.status ? { status: body.status } : {}),
    ...(body.detectionMeta ? { detectionMeta: body.detectionMeta } : {}),
  });
  if (!row) throw notFound('That game');
  return toSession(game, row);
}

const CursorSchema = z.object({ playedAt: z.string().min(1), id: z.uuid() });

function encodeCursor(row: SessionRow): string {
  const cursor: SessionCursor = { playedAt: row.playedAt, id: row.id };
  return Buffer.from(JSON.stringify(cursor)).toString('base64url');
}

function decodeCursor(value: string): SessionCursor {
  try {
    const json: unknown = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    return CursorSchema.parse(json);
  } catch {
    throw new AppError('VALIDATION', 400, 'The page cursor is invalid.');
  }
}

export async function listSessions(
  auth: AuthContext,
  gameId: string,
  cursor: string | undefined,
): Promise<SessionPage> {
  const game = requireGame(gameId);
  const after = cursor === undefined ? undefined : decodeCursor(cursor);
  const [rows, scores] = await Promise.all([
    listSessionRows(auth.db, auth.userId, game.id, SESSION_PAGE_SIZE + 1, after),
    completedScores(auth.db, auth.userId, game.id),
  ]);
  const page = rows.slice(0, SESSION_PAGE_SIZE);
  const last = page.at(-1);
  return {
    items: page.map((row) => ({
      id: row.id,
      gameId: game.id,
      status: row.status,
      scoreTotal: row.scoreTotal,
      playedAt: new Date(row.playedAt).toISOString(),
    })),
    nextCursor: rows.length > SESSION_PAGE_SIZE && last ? encodeCursor(last) : null,
    best: scores.length > 0 ? Math.max(...scores) : null,
    average:
      scores.length > 0
        ? Math.round((scores.reduce((sum, s) => sum + s, 0) / scores.length) * 10) / 10
        : null,
  };
}
