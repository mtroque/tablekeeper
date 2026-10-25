import { GAMES } from '@tablekeeper/core';
import type { Metadata } from 'next';

import { GameTabs } from '@/components/game-tabs';
import { GAME_UI } from '@/games/registry';

import { gameFromParams } from './game';

type Props = { children: React.ReactNode; params: Promise<{ gameId: string }> };

export function generateStaticParams() {
  return GAMES.map((game) => ({ gameId: game.id }));
}

export async function generateMetadata({ params }: Pick<Props, 'params'>): Promise<Metadata> {
  return { title: (await gameFromParams(params)).name };
}

export default async function GameLayout({ children, params }: Props) {
  const game = await gameFromParams(params);
  const { Motif } = GAME_UI[game.id];
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center gap-3 px-4 pt-5 pb-3">
        <Motif className="size-12 shrink-0" />
        <div>
          <h1 className="text-2xl leading-tight">{game.name}</h1>
          <p className="text-sm text-muted">{game.edition}</p>
        </div>
      </div>
      <GameTabs game={{ id: game.id, features: game.features }} />
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}
