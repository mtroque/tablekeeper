'use client';

import { azul, type SessionSummary } from '@tablekeeper/core';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ChevronRight, Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { useAuth } from '@/components/auth-provider';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { SessionStore } from '@/lib/session-store/session-store';
import { useSessionStore } from '@/lib/session-store/use-session-store';

import { addInProgress, readInProgress, removeInProgress } from './in-progress';

export const AZUL_SCORE = '/games/azul/score';

const DATE = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' });

/** Signed in: the account's games in progress. Guest: the ones kept on this device. */
async function gamesInProgress(store: SessionStore, signedIn: boolean): Promise<SessionSummary[]> {
  if (signedIn) {
    const page = await store.list(azul.id);
    return page.items.filter((item) => item.status === 'in_progress');
  }
  const ids = readInProgress(localStorage);
  const sessions = await Promise.all(ids.map((id) => store.get(id)));
  const found = sessions.filter((s) => s !== null && s.status === 'in_progress');
  removeInProgress(
    localStorage,
    ids.filter((id) => !found.some((s) => s?.id === id)),
  );
  return found.flatMap((s) =>
    s
      ? [
          {
            id: s.id,
            gameId: s.gameId,
            status: s.status,
            scoreTotal: s.scoreTotal,
            playedAt: s.playedAt,
          },
        ]
      : [],
  );
}

/** Azul score home: start a game, or pick up one in progress. */
export function AzulScoreHome() {
  const router = useRouter();
  const auth = useAuth();
  const store = useSessionStore();
  const signedIn = auth.status === 'signed-in';
  const games = useQuery({
    queryKey: ['azul-in-progress', auth.status],
    enabled: store !== null,
    queryFn: () => {
      if (!store) throw new Error('Store not ready');
      return gamesInProgress(store, signedIn);
    },
  });
  const start = useMutation({
    mutationFn: () => {
      if (!store) throw new Error('Store not ready');
      return store.save({
        gameId: azul.id,
        status: 'in_progress',
        state: azul.initialState(),
        stateVersion: azul.stateVersion,
      });
    },
    onSuccess: (session) => {
      if (!signedIn) addInProgress(localStorage, session.id);
      router.push(`${AZUL_SCORE}/${session.id}`);
    },
  });
  const offline = typeof navigator !== 'undefined' && !navigator.onLine;

  return (
    <section className="flex flex-col gap-6 px-4 py-5">
      <div className="flex flex-col gap-2">
        <h2 className="text-lg">Track a Game</h2>
        <p className="text-muted">
          After each round, tap in your chocolate box and foundry line. Only what changed is scored,
          so the total stays right without reading the score track.
        </p>
        {start.isError && (
          <p className="text-danger" role="alert">
            {offline ? "You're offline." : "Couldn't start the game. Try again."}
          </p>
        )}
        <Button
          disabled={!store || start.isPending}
          onClick={() => {
            start.mutate();
          }}
        >
          <Plus />
          {start.isPending ? 'Starting' : 'New Game'}
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-lg">Games in Progress</h2>
        {(auth.status === 'loading' || games.isPending) && (
          <ul aria-busy="true" className="border-t border-line">
            {[0, 1].map((i) => (
              <li key={i} className="flex justify-between border-b border-line py-3">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-5 w-16" />
              </li>
            ))}
          </ul>
        )}
        {games.isError && (
          <div className="flex flex-col gap-2" role="alert">
            <p>Couldn&apos;t load your games in progress. Try again.</p>
            <Button variant="secondary" onClick={() => void games.refetch()}>
              Try Again
            </Button>
          </div>
        )}
        {games.data?.length === 0 && (
          <p className="text-muted">
            {signedIn
              ? 'No games in progress. Start one when you sit down to play.'
              : 'No games in progress on this device. Start one when you sit down to play.'}
          </p>
        )}
        {games.data && games.data.length > 0 && (
          <ul className="border-t border-line" aria-label="Games in Progress">
            {games.data.map((game) => (
              <li key={game.id} className="border-b border-line">
                <Link
                  href={`${AZUL_SCORE}/${game.id}`}
                  className="flex min-h-11 items-center justify-between gap-3 py-3"
                >
                  <span>Started {DATE.format(new Date(game.playedAt))}</span>
                  <span className="flex items-center gap-2 text-muted tabular">
                    {game.scoreTotal ?? 0} {game.scoreTotal === 1 ? 'Point' : 'Points'}
                    <ChevronRight className="size-4 stroke-[1.5]" aria-hidden />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
