'use client';

import { dorfromantik, rankFor } from '@tablekeeper/core';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { useAuth } from '@/components/auth-provider';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { LoadError, SheetSkeleton } from './states';
import { UnlockPicker } from './unlock-picker';
import { useCampaign } from './use-campaign';
import { useSheetFlow } from './use-sheet';

const GAME = `/games/${dorfromantik.id}`;
const HIGHLIGHT_MS = 900;

/** What this game unlocked, with one short highlight (docs/UX.md → Visuals → Calm motion). */
function UnlockedNow({ names }: { names: string[] }) {
  const [fresh, setFresh] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => {
      setFresh(false);
    }, HIGHLIGHT_MS);
    return () => {
      clearTimeout(timer);
    };
  }, []);
  return (
    <p
      role="status"
      className={cn(
        'rounded-control border border-line px-3 py-3 transition-colors duration-200 ease-calm motion-reduce:transition-none',
        fresh ? 'bg-accent-soft' : 'bg-surface',
      )}
    >
      Unlocked: {names.join(', ')}.
    </p>
  );
}

/** After "Finish Game": total, rank, circles to cross off, then "Any Unlocks?". */
export function FinishScreen() {
  const { flow, update } = useSheetFlow();
  const { query } = useCampaign();
  const auth = useAuth();
  const [unlockedNow, setUnlockedNow] = useState<string[]>([]);

  if (!flow) return <SheetSkeleton />;
  const game = flow.finished;
  if (!game?.recorded) {
    return (
      <section className="flex flex-col items-center gap-3 px-4 py-10 text-center">
        <p>No finished game to show. Fill in a scoresheet first.</p>
        <Button asChild>
          <Link href={`${GAME}/score`}>New Scoresheet</Link>
        </Button>
      </section>
    );
  }

  const rank = rankFor(game.total);

  return (
    <section className="flex flex-col gap-5 px-4 py-6">
      <div className="flex flex-col items-center gap-1 text-center">
        <p className="text-muted">Game {game.gameNumber}</p>
        <p className="font-display text-5xl tabular" data-testid="finish-total">
          {game.total} Points
        </p>
        <p className="text-xl" data-testid="finish-rank">
          {rank.title}
        </p>
      </div>
      <p className="border-y border-line py-3" data-testid="finish-circles">
        {rank.circles === 1
          ? 'Cross off 1 circle on your campaign sheet.'
          : `Cross off ${rank.circles} circles on your campaign sheet.`}
      </p>

      {!game.unlocksDone &&
        (query.isPending ? (
          <SheetSkeleton />
        ) : query.isError ? (
          <LoadError
            onRetry={() => {
              void query.refetch();
            }}
          />
        ) : (
          <UnlockPicker
            campaign={query.data.state}
            gameNumber={game.gameNumber}
            onDone={({ names }) => {
              setUnlockedNow(names);
              update({ finished: { ...game, unlocksDone: true } });
            }}
          />
        ))}

      {game.unlocksDone && (
        <>
          {unlockedNow.length > 0 && <UnlockedNow names={unlockedNow} />}
          {auth.status === 'guest' && (
            <p className="text-muted">
              Saved to the campaign on this device. Sign in to keep a history of your games.
            </p>
          )}
          <div className="flex flex-col gap-2">
            {auth.status === 'signed-in' && (
              <Button asChild variant="secondary">
                <Link href={`${GAME}/history/${game.sessionId}`}>See Saved Game</Link>
              </Button>
            )}
            <Button asChild variant="secondary">
              <Link href={`${GAME}/campaign`}>See Campaign</Link>
            </Button>
            <Button asChild>
              <Link href={`${GAME}/score`}>Score Next Game</Link>
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
