'use client';

import type { GameDefinition } from '@tablekeeper/core';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { tabStyles } from '@/components/ui/tabs';
import { gameTabs } from '@/lib/game-tabs';

/** The hub's tab bar, built from the game's features. Each tab is its own route. */
export function GameTabs({ game }: { game: Pick<GameDefinition, 'id' | 'features'> }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Game sections" className={tabStyles.list}>
      {gameTabs(game.id, game.features).map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            className={tabStyles.trigger}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
