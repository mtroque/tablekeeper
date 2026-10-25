'use client';

import { blankSheet, dorfromantik, nextGameNumber } from '@tablekeeper/core';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { notFound, useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { sessionKeys } from '@/lib/session-store/use-session-store';

import type { ScoreFlowProps } from '../types';

import { finishGame } from './finish-game';
import { FinishScreen } from './finish-screen';
import { Scoresheet } from './scoresheet';
import { LoadError, SheetSkeleton } from './states';
import { useCampaign } from './use-campaign';
import { useSheetFlow } from './use-sheet';

const BASE = `/games/${dorfromantik.id}/score`;

function SheetPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { store, key, query } = useCampaign();
  const { flow, update } = useSheetFlow();

  const finish = useMutation({
    mutationFn: () => {
      if (!store || !flow || !query.data) throw new Error('Not ready');
      const sheet = flow.sheet ?? blankSheet(query.data.state);
      const pending = flow.finished && !flow.finished.recorded ? flow.finished : null;
      return finishGame(store, sheet, pending, (game) => {
        update({ finished: game });
      });
    },
    onSuccess: async ({ game, campaign }) => {
      queryClient.setQueryData(key, campaign);
      await queryClient.invalidateQueries({ queryKey: sessionKeys.list(dorfromantik.id) });
      update({ sheet: null, finished: game });
      router.push(`${BASE}/finish`);
    },
  });

  if (!flow || query.isPending) return <SheetSkeleton />;
  if (query.isError) {
    return (
      <LoadError
        onRetry={() => {
          void query.refetch();
        }}
      />
    );
  }

  const campaign = query.data.state;
  // The game number always follows the campaign, even for a sheet started before a save.
  const sheet = { ...(flow.sheet ?? blankSheet(campaign)), gameNumber: nextGameNumber(campaign) };
  const offline = typeof navigator !== 'undefined' && !navigator.onLine;

  return (
    <Scoresheet
      campaign={campaign}
      sheet={sheet}
      onChange={(next) => {
        update({ sheet: next });
      }}
      footer={
        <>
          {finish.isError && (
            <p className="text-danger" role="alert">
              {offline ? "You're offline." : "Couldn't save the game. Try again."}
            </p>
          )}
          <Button
            disabled={finish.isPending || !store}
            onClick={() => {
              finish.mutate();
            }}
          >
            {finish.isPending ? 'Saving' : finish.isError ? 'Try Again' : 'Finish Game'}
          </Button>
        </>
      }
    />
  );
}

/** The scoresheet at `/score`, the finished game at `/score/finish` (docs/UX.md → Dorfromantik). */
export function ScoreFlow({ slug }: ScoreFlowProps) {
  if (slug.length === 0) return <SheetPage />;
  if (slug.length === 1 && slug[0] === 'finish') return <FinishScreen />;
  notFound();
}
