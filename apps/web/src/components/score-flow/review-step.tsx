'use client';

import type { GameDefinition } from '@tablekeeper/core';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { ConfidenceBanner, isLowConfidence } from '@/components/confidence-outline';
import { Button } from '@/components/ui/button';
import type { GameUiModule } from '@/games/types';
import type { FlowState } from '@/lib/session-store/flow-state';

import { scoreOf, type useFlow } from './use-flow';

/** The editor with the draft (or an empty board), a running total and See Score. */
export function ReviewStep({
  game,
  ui,
  flow,
}: {
  game: GameDefinition;
  ui: GameUiModule;
  flow: ReturnType<typeof useFlow> & { flow: FlowState };
}) {
  const router = useRouter();
  const base = `/games/${game.id}/score`;
  const { Editor } = ui;
  const confidence = flow.flow.draft?.confidence;
  const lowCount = Object.values(confidence ?? {}).filter(isLowConfidence).length;
  const total = scoreOf(game, flow.flow)?.total;

  return (
    <section className="flex flex-col gap-4 px-4 py-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg">Review Board</h2>
        {total !== undefined && (
          <p className="font-display text-2xl tabular" data-testid="running-total">
            {total} {Math.abs(total) === 1 ? 'Point' : 'Points'}
          </p>
        )}
      </div>
      <ConfidenceBanner count={lowCount} noun={['value', 'values']} />
      {Editor ? (
        <Editor
          state={flow.flow.state}
          {...(confidence ? { confidence } : {})}
          onChange={(state) => {
            flow.setFlow({ ...flow.flow, state });
          }}
        />
      ) : (
        <p className="text-muted">The board editor for {game.name} is on its way.</p>
      )}
      <Button asChild>
        <Link href={`${base}/result`}>See Score</Link>
      </Button>
      <Button
        variant="quiet"
        onClick={() => {
          flow.reset();
          router.push(base);
        }}
      >
        Start Over
      </Button>
    </section>
  );
}
