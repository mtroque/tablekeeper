import type { GameFeatures, GameId } from '@tablekeeper/core';

export type GameTab = {
  key: 'score' | 'campaign' | 'rules' | 'history';
  label: string;
  href: string;
};

/** The hub's tabs from the game's features, in the order Score, Campaign, Rules, History (docs/UX.md). */
export function gameTabs(gameId: GameId, features: GameFeatures): GameTab[] {
  const tabs: GameTab[] = [];
  const href = (key: GameTab['key']) => `/games/${gameId}/${key}`;
  if (features.scorer) tabs.push({ key: 'score', label: 'Score', href: href('score') });
  if (features.campaign) tabs.push({ key: 'campaign', label: 'Campaign', href: href('campaign') });
  if (features.rules) tabs.push({ key: 'rules', label: 'Rules', href: href('rules') });
  // History is the history of scored plays.
  if (features.scorer) tabs.push({ key: 'history', label: 'History', href: href('history') });
  return tabs;
}

/** Feature tags on a library card. */
export function featureTags(features: GameFeatures): string[] {
  const tags: string[] = [];
  if (features.rules) tags.push('Rules');
  if (features.photo) tags.push('Photo Scoring');
  else if (features.scorer) tags.push('Scoring');
  if (features.campaign) tags.push('Campaign');
  return tags;
}
