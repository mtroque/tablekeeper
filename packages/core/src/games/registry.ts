import type { GameDefinition, GameId } from '../kit/types';

import { azul } from './azul';
import { dorfromantik } from './dorfromantik';
import { harmonies } from './harmonies';
import { patchwork } from './patchwork';

/** Every supported game, in library order. Pre-registered: game slices never edit this file. */
export const GAMES: readonly GameDefinition[] = [patchwork, azul, harmonies, dorfromantik];

export const GAME_IDS: readonly GameId[] = GAMES.map((game) => game.id);

export function isGameId(value: string): value is GameId {
  return (GAME_IDS as readonly string[]).includes(value);
}

export function getGame(id: string): GameDefinition | undefined {
  return GAMES.find((game) => game.id === id);
}
