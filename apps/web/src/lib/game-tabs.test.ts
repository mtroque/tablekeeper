import { GAMES, getGame } from '@tablekeeper/core';
import { describe, expect, it } from 'vitest';

import { featureTags, gameTabs } from './game-tabs';

const labels = (id: string) => {
  const game = getGame(id);
  if (!game) throw new Error(id);
  return gameTabs(game.id, game.features).map((tab) => tab.label);
};

describe('gameTabs', () => {
  it('shows all four tabs for Dorfromantik and three for the others', () => {
    expect(labels('dorfromantik')).toEqual(['Score', 'Campaign', 'Rules', 'History']);
    for (const id of ['patchwork', 'azul', 'harmonies']) {
      expect(labels(id)).toEqual(['Score', 'Rules', 'History']);
    }
  });

  it('links each tab under the game', () => {
    expect(
      gameTabs('azul', { rules: true, scorer: true, campaign: false, photo: false })[0]?.href,
    ).toBe('/games/azul/score');
  });

  it('hides tabs for unsupported features', () => {
    expect(gameTabs('azul', { rules: true, scorer: false, campaign: false, photo: false })).toEqual(
      [{ key: 'rules', label: 'Rules', href: '/games/azul/rules' }],
    );
  });
});

describe('featureTags', () => {
  it('tags each game from its features', () => {
    expect(Object.fromEntries(GAMES.map((game) => [game.id, featureTags(game.features)]))).toEqual({
      patchwork: ['Rules', 'Photo Scoring'],
      azul: ['Rules', 'Scoring'],
      harmonies: ['Rules', 'Photo Scoring'],
      dorfromantik: ['Rules', 'Scoring', 'Campaign'],
    });
  });
});
