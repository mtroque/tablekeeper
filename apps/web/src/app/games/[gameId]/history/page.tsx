import { notFound } from 'next/navigation';

import { gameFromParams } from '../game';

import { HistoryList } from './history-list';

export default async function HistoryPage({ params }: { params: Promise<{ gameId: string }> }) {
  const game = await gameFromParams(params);
  if (!game.features.scorer) notFound();
  return <HistoryList gameId={game.id} />;
}
