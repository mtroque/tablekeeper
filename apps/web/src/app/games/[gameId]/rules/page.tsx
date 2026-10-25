import { notFound } from 'next/navigation';

import { gameFromParams } from '../game';

import { RulesAssistant } from './rules-assistant';

export default async function RulesPage({ params }: { params: Promise<{ gameId: string }> }) {
  const game = await gameFromParams(params);
  if (!game.features.rules) notFound();
  return (
    <RulesAssistant
      gameId={game.id}
      gameName={game.name}
      rulebookUrl={game.rulebook.publisherUrl}
      starters={game.rulesStarters}
    />
  );
}
