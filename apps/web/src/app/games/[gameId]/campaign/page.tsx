import { notFound } from 'next/navigation';

import { ComingSoon } from '@/components/coming-soon';

import { gameFromParams } from '../game';

// Placeholder until slice S1 builds this tab.
export default async function CampaignPage({ params }: { params: Promise<{ gameId: string }> }) {
  const game = await gameFromParams(params);
  if (!game.features.campaign) notFound();
  return (
    <ComingSoon title="Coming Soon">The {game.name} campaign tracker is on its way.</ComingSoon>
  );
}
