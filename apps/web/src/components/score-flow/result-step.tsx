'use client';

import type { GameDefinition, SessionInput } from '@tablekeeper/core';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { useAuth } from '@/components/auth-provider';
import { BreakdownList } from '@/components/breakdown-list';
import { SignInPrompt } from '@/components/sign-in-prompt';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { GameUiModule } from '@/games/types';
import { detectionMeta } from '@/lib/session-store/detection-meta';
import type { FlowState } from '@/lib/session-store/flow-state';
import { clearPendingSave, setPendingSave } from '@/lib/session-store/pending-save';
import { sessionKeys, useSessionStore } from '@/lib/session-store/use-session-store';

import { scoreOf, type useFlow } from './use-flow';

/** Breakdown and save: signed in saves; a guest signs in (saved on return) or doesn't save. */
export function ResultStep({
  game,
  ui,
  flow,
}: {
  game: GameDefinition;
  ui: GameUiModule;
  flow: ReturnType<typeof useFlow> & { flow: FlowState };
}) {
  const router = useRouter();
  const auth = useAuth();
  const store = useSessionStore();
  const queryClient = useQueryClient();
  const [selectedKey, setSelectedKey] = useState<string | undefined>();
  const base = `/games/${game.id}/score`;
  const breakdown = scoreOf(game, flow.flow);

  const meta = detectionMeta(flow.flow.draft, flow.flow.state);
  const input: SessionInput = {
    gameId: game.id,
    status: 'completed',
    state: flow.flow.state,
    stateVersion: flow.flow.stateVersion,
    ...(meta ? { detectionMeta: meta } : {}),
  };

  const save = useMutation({
    mutationFn: () => {
      if (!store) throw new Error('Store not ready');
      return store.save(input);
    },
    onSuccess: async (session) => {
      await queryClient.invalidateQueries({ queryKey: sessionKeys.list(game.id) });
      flow.discard();
      router.push(`/games/${game.id}/history/${session.id}`);
    },
  });

  if (!breakdown) {
    return (
      <section className="flex flex-col gap-3 px-4 py-5">
        <p>This board isn&apos;t complete yet.</p>
        <Button asChild>
          <Link href={`${base}/review`}>Review Board</Link>
        </Button>
      </section>
    );
  }

  const { Breakdown } = ui;
  const offline = typeof navigator !== 'undefined' && !navigator.onLine;

  return (
    <section className="flex flex-col gap-5 py-5">
      <div className="flex flex-col gap-4 px-4">
        {Breakdown && (
          <Breakdown
            state={flow.flow.state}
            breakdown={breakdown}
            {...(selectedKey ? { selectedKey } : {})}
          />
        )}
      </div>
      <BreakdownList breakdown={breakdown} selectedKey={selectedKey} onSelect={setSelectedKey} />
      <div className="flex flex-col gap-2 px-4">
        {auth.status === 'loading' && <Skeleton className="h-11 w-full" />}
        {auth.status === 'signed-in' && (
          <>
            {save.isError && (
              <p className="text-danger" role="alert">
                {offline ? "You're offline." : "Couldn't save the game. Try again."}
              </p>
            )}
            <Button
              disabled={save.isPending || !store}
              onClick={() => {
                save.mutate();
              }}
            >
              {save.isPending ? 'Saving' : save.isError ? 'Try Again' : 'Save Game'}
            </Button>
          </>
        )}
        <Button asChild variant="quiet">
          <Link href={`${base}/review`}>Edit Board</Link>
        </Button>
      </div>
      {auth.status === 'guest' && (
        <div className="flex flex-col gap-2">
          <SignInPrompt
            title="Save This Game"
            beforeSignIn={() => {
              setPendingSave(sessionStorage, { input });
            }}
          >
            Sign in to keep your scores, history and personal bests.
          </SignInPrompt>
          <div className="px-4">
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => {
                clearPendingSave(sessionStorage);
                flow.reset();
                router.push(base);
              }}
            >
              Don&apos;t Save
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
