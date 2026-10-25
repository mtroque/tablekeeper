'use client';

import { dorfromantik } from '@tablekeeper/core';
import Link from 'next/link';

import { useAuth } from '@/components/auth-provider';
import { Button } from '@/components/ui/button';

import { SheetSkeleton } from './states';
import { useSheetFlow } from './use-sheet';

const GAME = `/games/${dorfromantik.id}`;

/** After "Finish Game": the saved total and where to go next. */
export function FinishScreen() {
  const { flow } = useSheetFlow();
  const auth = useAuth();

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

  return (
    <section className="flex flex-col gap-5 px-4 py-6">
      <div className="flex flex-col items-center gap-1 text-center">
        <p className="text-muted">Game {game.gameNumber}</p>
        <p className="font-display text-5xl tabular" data-testid="finish-total">
          {game.total} Points
        </p>
      </div>
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
    </section>
  );
}
