import { redirect } from 'next/navigation';

import { gameTabs } from '@/lib/game-tabs';

import { gameFromParams } from './game';

/** Redirects to the game's first tab (Score, or Rules if it has no scorer). */
export default async function GamePage({ params }: { params: Promise<{ gameId: string }> }) {
  const game = await gameFromParams(params);
  const first = gameTabs(game.id, game.features)[0];
  redirect(first?.href ?? '/');
}
