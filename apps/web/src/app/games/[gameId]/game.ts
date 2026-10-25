import { getGame, type GameDefinition } from '@tablekeeper/core';
import { notFound } from 'next/navigation';

/** The game for a hub route, or the not-found page. */
export async function gameFromParams(params: Promise<{ gameId: string }>): Promise<GameDefinition> {
  const game = getGame((await params).gameId);
  if (!game) notFound();
  return game;
}
