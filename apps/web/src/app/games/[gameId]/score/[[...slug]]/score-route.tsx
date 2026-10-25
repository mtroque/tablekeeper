'use client';

import type { GameId } from '@tablekeeper/core';

import { DefaultScoreFlow } from '@/components/score-flow/default-score-flow';
import { GAME_UI } from '@/games/registry';

/** Game slices never add routes: a module's ScoreFlow gets the path below `/score`. */
export function ScoreRoute({ gameId, slug }: { gameId: GameId; slug: string[] }) {
  const { ScoreFlow } = GAME_UI[gameId];
  return ScoreFlow ? (
    <ScoreFlow gameId={gameId} slug={slug} />
  ) : (
    <DefaultScoreFlow gameId={gameId} slug={slug} />
  );
}
