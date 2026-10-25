import type { GameDefinition, Result } from './types';

export type StateError =
  | { kind: 'future-version'; message: string }
  | { kind: 'no-upgrade'; message: string }
  | { kind: 'invalid'; message: string; issues: Array<{ path: string; message: string }> };

/**
 * Reads stored or sent state: upgrades it from `fromVersion` to the game's current version,
 * then validates it with the game's schema (docs/ARCHITECTURE.md → Game modules).
 */
export function parseState<State>(
  game: Pick<GameDefinition<State>, 'stateSchema' | 'stateVersion' | 'upgrade'>,
  raw: unknown,
  fromVersion: number,
): Result<State, StateError> {
  if (fromVersion > game.stateVersion) {
    return {
      ok: false,
      error: {
        kind: 'future-version',
        message: `State version ${fromVersion} is newer than ${game.stateVersion}.`,
      },
    };
  }
  let state = raw;
  if (fromVersion < game.stateVersion) {
    if (!game.upgrade) {
      return {
        ok: false,
        error: { kind: 'no-upgrade', message: `State version ${fromVersion} can't be upgraded.` },
      };
    }
    state = game.upgrade(raw, fromVersion);
  }
  const parsed = game.stateSchema.safeParse(state);
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        kind: 'invalid',
        message: 'The board state is invalid.',
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      },
    };
  }
  return { ok: true, value: parsed.data };
}
