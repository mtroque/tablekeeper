import { GAMES } from '@tablekeeper/core';

import { PrivacyLink } from '@/app/privacy/privacy-link';
import { GameCard } from '@/components/game-card';

/** Game library, from the local registry so it renders even while the API sleeps. */
export default function LibraryPage() {
  return (
    <div className="flex flex-col gap-4 px-4 py-6">
      <h1 className="text-3xl">Your Games</h1>
      <ul className="flex flex-col gap-3">
        {GAMES.map((game) => (
          <li key={game.id}>
            <GameCard game={game} />
          </li>
        ))}
      </ul>
      <PrivacyLink />
    </div>
  );
}
