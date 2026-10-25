import { notFound } from 'next/navigation';

import { gameFromParams } from '../../game';

import { ScoreRoute } from './score-route';

type Props = { params: Promise<{ gameId: string; slug?: string[] }> };

/** `/games/[gameId]/score/**`: the game's own ScoreFlow, or the default flow. */
export default async function ScorePage({ params }: Props) {
  const game = await gameFromParams(params);
  if (!game.features.scorer) notFound();
  const { slug = [] } = await params;
  return <ScoreRoute gameId={game.id} slug={slug} />;
}
