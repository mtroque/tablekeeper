import { notFound } from 'next/navigation';

import { ComingSoon } from '@/components/coming-soon';

import { gameFromParams } from '../game';

// Placeholder until slice S1 builds this tab.
export default async function ScorePage({ params }: { params: Promise<{ gameId: string }> }) {
  const game = await gameFromParams(params);
  if (!game.features.scorer) notFound();
  return <ComingSoon title="Coming Soon">{game.name} scoring is on its way.</ComingSoon>;
}
