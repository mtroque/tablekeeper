'use client';

import type { GameId } from '@tablekeeper/core';
import { useInfiniteQuery } from '@tanstack/react-query';
import { ChevronRight } from 'lucide-react';
import Link from 'next/link';

import { useAuth } from '@/components/auth-provider';
import { SignInPrompt } from '@/components/sign-in-prompt';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { sessionKeys, useSessionStore } from '@/lib/session-store/use-session-store';

import { formatPlayedAt, points } from './format';

function RowSkeletons({ count }: { count: number }) {
  return Array.from({ length: count }, (_, i) => (
    <li key={i} className="flex items-center justify-between border-b border-line px-4 py-3">
      <Skeleton className="h-5 w-36" />
      <Skeleton className="h-5 w-16" />
    </li>
  ));
}

/** Saved games, newest first, with personal best and average. Signed-in only. */
export function HistoryList({ gameId }: { gameId: GameId }) {
  const auth = useAuth();
  const store = useSessionStore();
  const signedIn = auth.status === 'signed-in';
  const query = useInfiniteQuery({
    queryKey: sessionKeys.list(gameId),
    enabled: signedIn && store !== null,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => {
      if (!store) throw new Error('Store not ready');
      return store.list(gameId, pageParam);
    },
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });

  if (auth.status === 'guest') {
    return (
      <SignInPrompt title="Keep a History">
        Sign in to save your games and see your personal best and average.
      </SignInPrompt>
    );
  }

  if (auth.status === 'loading' || query.isPending) {
    return (
      <section aria-busy="true" className="flex flex-col">
        <div className="flex gap-6 px-4 py-4">
          <Skeleton className="h-12 w-24" />
          <Skeleton className="h-12 w-24" />
        </div>
        <ul className="border-t border-line">
          <RowSkeletons count={4} />
        </ul>
      </section>
    );
  }

  // A failed "Show More" keeps the pages already loaded; only a failed first load replaces them.
  if (!query.data) {
    return (
      <section className="flex flex-col gap-3 px-4 py-5" role="alert">
        <p>Couldn&apos;t load your history. Try again.</p>
        <Button variant="secondary" onClick={() => void query.refetch()}>
          Try Again
        </Button>
      </section>
    );
  }

  const [first] = query.data.pages;
  const items = query.data.pages.flatMap((page) => page.items);

  if (items.length === 0) {
    return (
      <section className="flex flex-col items-center gap-3 px-6 py-12 text-center">
        <p className="text-muted">Games you save show up here.</p>
        <Button asChild>
          <Link href={`/games/${gameId}/score`}>Score a Game</Link>
        </Button>
      </section>
    );
  }

  return (
    <section className="flex flex-col">
      <dl className="flex gap-8 px-4 py-4">
        <div>
          <dt className="text-sm text-muted">Personal Best</dt>
          <dd className="font-display text-3xl tabular" data-testid="personal-best">
            {first?.best ?? 'None'}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted">Average</dt>
          <dd className="font-display text-3xl tabular" data-testid="average">
            {first?.average ?? 'None'}
          </dd>
        </div>
      </dl>
      <ul className="border-t border-line" aria-label="Saved Games">
        {items.map((item) => (
          <li key={item.id} className="border-b border-line">
            <Link
              href={`/games/${gameId}/history/${item.id}`}
              className="flex min-h-11 items-center justify-between gap-3 px-4 py-3 hover:bg-ink/5"
              data-testid="history-item"
            >
              <span>
                {formatPlayedAt(item.playedAt)}
                {item.status === 'in_progress' && (
                  <span className="ml-2 rounded-control bg-accent-soft px-2 py-0.5 text-xs font-semibold">
                    In Progress
                  </span>
                )}
              </span>
              <span className="flex items-center gap-1 tabular">
                {points(item.scoreTotal)}
                <ChevronRight className="size-4 stroke-[1.5] text-muted" aria-hidden />
              </span>
            </Link>
          </li>
        ))}
        {query.isFetchingNextPage && <RowSkeletons count={3} />}
      </ul>
      {query.hasNextPage && (
        <div className="px-4 py-4">
          <Button
            variant="secondary"
            className="w-full"
            disabled={query.isFetchingNextPage}
            onClick={() => void query.fetchNextPage()}
          >
            Show More
          </Button>
          {query.isFetchNextPageError && (
            <p className="pt-2 text-danger" role="alert">
              Couldn&apos;t load more games. Try again.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
