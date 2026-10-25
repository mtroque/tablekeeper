import { notFound } from 'next/navigation';

import { gameFromParams } from '../../game';

import { SessionDetail } from './session-detail';

type Props = { params: Promise<{ gameId: string; sessionId: string }> };

export default async function SessionPage({ params }: Props) {
  const game = await gameFromParams(params);
  if (!game.features.scorer) notFound();
  const { sessionId } = await params;
  return <SessionDetail gameId={game.id} sessionId={sessionId} />;
}
