import type { GameDefinition } from './types';

/**
 * Checks a game against its own state type, then erases that type so it fits the registry.
 * Safe because shared code only passes a game's `score` state it parsed with that game's
 * `stateSchema` (see `parseState`).
 */
export function defineGame<State>(game: GameDefinition<State>): GameDefinition {
  return game as unknown as GameDefinition;
}
