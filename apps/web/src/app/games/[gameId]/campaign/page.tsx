import { notFound } from 'next/navigation';

import { gameFromParams } from '../game';

import { CampaignRoute } from './campaign-route';

export default async function CampaignPage({ params }: { params: Promise<{ gameId: string }> }) {
  const game = await gameFromParams(params);
  if (!game.features.campaign) notFound();
  return <CampaignRoute gameId={game.id} name={game.name} />;
}
