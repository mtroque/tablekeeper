import { describe, expect, it } from 'vitest';

import { GAMES, getGame, isGameId } from './registry';

describe('game registry', () => {
  it('registers the four games in library order', () => {
    expect(GAMES.map((game) => game.id)).toEqual([
      'patchwork',
      'azul',
      'harmonies',
      'dorfromantik',
    ]);
  });

  it('gives every game the features from docs/PRODUCT.md', () => {
    const features = Object.fromEntries(GAMES.map((game) => [game.id, game.features]));
    expect(features).toEqual({
      patchwork: { rules: true, scorer: true, campaign: false, photo: true },
      azul: { rules: true, scorer: true, campaign: false, photo: false },
      harmonies: { rules: true, scorer: true, campaign: false, photo: true },
      dorfromantik: { rules: true, scorer: true, campaign: true, photo: false },
    });
  });

  it.each(GAMES)('$id has an edition, an https rulebook and three starter questions', (game) => {
    expect(game.edition).not.toBe('');
    expect(new URL(game.rulebook.publisherUrl).protocol).toBe('https:');
    expect(game.rulebook.sourceKey).toBe(game.id);
    expect(game.rulesStarters).toHaveLength(3);
    // The S0 placeholder state is version 0 until the game's scorer slice defines its state.
    if (!game.score) expect(game.stateVersion).toBe(0);
  });

  it('looks games up by id', () => {
    expect(getGame('azul')?.name).toBe('Azul');
    expect(getGame('chess')).toBeUndefined();
    expect(isGameId('harmonies')).toBe(true);
    expect(isGameId('chess')).toBe(false);
  });
});
