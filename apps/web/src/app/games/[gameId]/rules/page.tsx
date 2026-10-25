import { notFound } from 'next/navigation';

import { ComingSoon } from '@/components/coming-soon';

import { gameFromParams } from '../game';

// Placeholder until slice S3 builds this tab.
export default async function RulesPage({ params }: { params: Promise<{ gameId: string }> }) {
  const game = await gameFromParams(params);
  if (!game.features.rules) notFound();
  return (
    <ComingSoon title="Coming Soon">
      Answers from the {game.name} rulebook are on their way.
    </ComingSoon>
  );
}
