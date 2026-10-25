'use client';

import type { GameId } from '@tablekeeper/core';
import { notFound, useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { ComingSoon } from '@/components/coming-soon';
import { Skeleton } from '@/components/ui/skeleton';
import { GAME_UI } from '@/games/registry';

import { CaptureStep } from './capture-step';
import { ResultStep } from './result-step';
import { ReviewStep } from './review-step';
import { ScoreHome } from './score-home';
import { requireGame, useFlow } from './use-flow';

const STEPS = ['capture', 'review', 'result'] as const;
type Step = (typeof STEPS)[number] | 'home';

function stepOf(slug: string[]): Step | null {
  if (slug.length === 0) return 'home';
  const [first] = slug;
  return slug.length === 1 && STEPS.some((s) => s === first) ? (first as Step) : null;
}

/** Capture → review → result for any game with an `Editor` (docs/UX.md → Routes). */
export function DefaultScoreFlow({ gameId, slug }: { gameId: GameId; slug: string[] }) {
  const router = useRouter();
  const game = requireGame(gameId);
  const ui = GAME_UI[gameId];
  const flow = useFlow(gameId);
  const step = stepOf(slug);
  // Every step after home needs a board in progress; without one (a new tab), start over.
  const lost = flow.status === 'ready' && step !== 'home' && !flow.flow;

  useEffect(() => {
    if (lost) router.replace(`/games/${gameId}/score`);
  }, [lost, gameId, router]);

  if (step === null) notFound();
  if (!ui.Editor) {
    return <ComingSoon title="Coming Soon">{game.name} scoring is on its way.</ComingSoon>;
  }
  if (flow.status === 'loading' || lost) {
    return (
      <div className="flex flex-col gap-3 px-4 py-5" aria-busy="true">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="aspect-square w-full" />
        <Skeleton className="h-11 w-full" />
      </div>
    );
  }
  if (step === 'home' || !flow.flow) return <ScoreHome game={game} ui={ui} flow={flow} />;

  const active = { ...flow, flow: flow.flow };
  switch (step) {
    case 'capture':
      return <CaptureStep game={game} flow={active} />;
    case 'review':
      return <ReviewStep game={game} ui={ui} flow={active} />;
    case 'result':
      return <ResultStep game={game} ui={ui} flow={active} />;
  }
}
