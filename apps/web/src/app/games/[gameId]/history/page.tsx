import { notFound } from 'next/navigation';

import { ComingSoon } from '@/components/coming-soon';

import { gameFromParams } from '../game';

// Placeholder until slice S1 builds this tab.
export default async function HistoryPage({ params }: { params: Promise<{ gameId: string }> }) {
  const game = await gameFromParams(params);
  if (!game.features.scorer) notFound();
  return <ComingSoon title="Coming Soon">Your {game.name} history is on its way.</ComingSoon>;
}
