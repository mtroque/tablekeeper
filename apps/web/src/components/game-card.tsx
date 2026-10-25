import type { GameDefinition } from '@tablekeeper/core';
import Link from 'next/link';

import { GAME_UI } from '@/games/registry';
import { featureTags } from '@/lib/game-tabs';

export function GameCard({ game }: { game: GameDefinition }) {
  const { Motif } = GAME_UI[game.id];
  return (
    <Link
      href={`/games/${game.id}`}
      data-testid={`game-card-${game.id}`}
      className="flex items-center gap-4 rounded-card border border-line bg-surface p-3 transition-colors duration-150 ease-calm hover:border-muted"
    >
      <Motif className="size-16 shrink-0" />
      <div className="flex min-w-0 flex-col gap-1.5">
        <div>
          <h2 className="text-lg leading-tight">{game.name}</h2>
          <p className="text-sm text-muted">{game.edition}</p>
        </div>
        <ul className="flex flex-wrap gap-1.5" aria-label="Features">
          {featureTags(game.features).map((tag) => (
            <li
              key={tag}
              className="rounded-control bg-accent-soft px-2 py-0.5 text-xs font-semibold text-ink"
            >
              {tag}
            </li>
          ))}
        </ul>
      </div>
    </Link>
  );
}
