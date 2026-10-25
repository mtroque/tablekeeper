'use client';

import type { GameId } from '@tablekeeper/core';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';

import { useAuth } from '@/components/auth-provider';
import { BreakdownList } from '@/components/breakdown-list';
import { SignInPrompt } from '@/components/sign-in-prompt';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { GAME_UI } from '@/games/registry';
import { sessionKeys, useSessionStore } from '@/lib/session-store/use-session-store';

import { formatPlayedAt } from '../format';

/** A saved game, read-only: the board with highlights and its breakdown. */
export function SessionDetail({ gameId, sessionId }: { gameId: GameId; sessionId: string }) {
  const auth = useAuth();
  const store = useSessionStore();
  const [selectedKey, setSelectedKey] = useState<string | undefined>();
  const query = useQuery({
    queryKey: sessionKeys.detail(sessionId),
    enabled: auth.status === 'signed-in' && store !== null,
    queryFn: () => {
      if (!store) throw new Error('Store not ready');
      return store.get(sessionId);
    },
  });
  const back = (
    <Button asChild variant="quiet">
      <Link href={`/games/${gameId}/history`}>All Games</Link>
    </Button>
  );

  if (auth.status === 'guest') {
    return (
      <SignInPrompt title="Sign In to See This Game">
        Saved games belong to an account.
      </SignInPrompt>
    );
  }
  if (auth.status === 'loading' || query.isPending) {
    return (
      <section className="flex flex-col items-center gap-4 px-4 py-5" aria-busy="true">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="size-40" />
        <Skeleton className="h-12 w-32" />
        <Skeleton className="h-11 w-full" />
      </section>
    );
  }
  if (query.isError) {
    return (
      <section className="flex flex-col gap-3 px-4 py-5" role="alert">
        <p>Couldn&apos;t load this game. Try again.</p>
        <Button variant="secondary" onClick={() => void query.refetch()}>
          Try Again
        </Button>
        {back}
      </section>
    );
  }
  const session = query.data;
  if (!session?.breakdown) {
    return (
      <section className="flex flex-col items-center gap-3 px-6 py-12 text-center">
        <p className="text-muted">This game wasn&apos;t found.</p>
        {back}
      </section>
    );
  }

  const { Breakdown } = GAME_UI[gameId];
  return (
    <section className="flex flex-col gap-4 py-5">
      <p className="px-4 text-muted">{formatPlayedAt(session.playedAt)}</p>
      {Breakdown && (
        <Breakdown
          state={session.state}
          breakdown={session.breakdown}
          {...(selectedKey ? { selectedKey } : {})}
        />
      )}
      <BreakdownList
        breakdown={session.breakdown}
        selectedKey={selectedKey}
        onSelect={setSelectedKey}
      />
      <div className="px-4">{back}</div>
    </section>
  );
}
