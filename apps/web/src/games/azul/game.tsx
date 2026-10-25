'use client';

import {
  azul,
  azulSignedPoints,
  AzulStateSchema,
  checkAzulRound,
  currentWall,
  scoreAzul,
  scoreAzulRounds,
  squareKey,
  type AzulRoundScore,
  type AzulState,
  type SessionStatus,
} from '@tablekeeper/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { z } from 'zod';

import { useAuth } from '@/components/auth-provider';
import { BreakdownList } from '@/components/breakdown-list';
import { SignInPrompt } from '@/components/sign-in-prompt';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { clearPendingSave, setPendingSave } from '@/lib/session-store/pending-save';
import { sessionKeys, useSessionStore } from '@/lib/session-store/use-session-store';

import { Breakdown } from './breakdown';
import { FoundryLine } from './foundry-line';
import { readDraft, removeInProgress, writeDraft, type Draft } from './in-progress';
import { AZUL_SCORE } from './score-home';
import { WallEditor } from './wall-editor';

function points(total: number): string {
  return `${total} ${Math.abs(total) === 1 ? 'Point' : 'Points'}`;
}

function Shell({ children }: { children: React.ReactNode }) {
  return <section className="flex flex-col gap-4 px-4 py-5">{children}</section>;
}

function BackToGames() {
  return (
    <Button asChild variant="quiet">
      <Link href={AZUL_SCORE}>Games in Progress</Link>
    </Button>
  );
}

/** Each confirmed round's score and the running total after it. */
function RoundStrip({ scores }: { scores: AzulRoundScore[] }) {
  if (scores.length === 0) return null;
  return (
    <ol aria-label="Rounds" className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1">
      {scores.map((score) => (
        <li
          key={score.round}
          className="flex min-w-16 flex-col items-start rounded-control border border-line bg-surface px-2.5 py-1.5"
          data-testid={`round-${score.round}`}
        >
          <span className="text-xs text-muted">Round {score.round}</span>
          <span className="font-display text-lg tabular">{score.totalAfter}</span>
          <span
            className={`text-xs tabular ${score.roundScore < 0 ? 'text-danger' : 'text-muted'}`}
          >
            {azulSignedPoints(score.roundScore)}
          </span>
        </li>
      ))}
    </ol>
  );
}

/** An Azul game in progress at `/games/azul/score/<sessionId>`, round by round. */
export function AzulGame({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const auth = useAuth();
  const store = useSessionStore();
  const queryClient = useQueryClient();
  const signedIn = auth.status === 'signed-in';
  const key = useMemo(
    () => ['azul-game', sessionId, auth.status] as const,
    [sessionId, auth.status],
  );
  // Session ids are UUIDs on both stores; anything else is no game at all.
  const validId = z.uuid().safeParse(sessionId).success;
  const query = useQuery({
    queryKey: key,
    enabled: store !== null && validId,
    queryFn: () => {
      if (!store) throw new Error('Store not ready');
      return store.get(sessionId);
    },
  });
  const [edits, setEdits] = useState<Draft | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | undefined>();

  const session = query.data;
  const parsed = session ? AzulStateSchema.safeParse(session.state) : null;
  const state: AzulState | null = parsed?.success ? parsed.data : null;
  const completed = session?.status === 'completed';

  // A finished, saved game lives in history.
  useEffect(() => {
    if (signedIn && completed) router.replace(`/games/azul/history/${sessionId}`);
  }, [signedIn, completed, router, sessionId]);

  const rounds = state?.rounds.length ?? 0;
  // The round being entered: this tab's taps, else a draft kept through a refresh, else the
  // chocolate box as last confirmed with an empty foundry line. Only read on the client,
  // since the session itself is only loaded there.
  const stored = state ? readDraft(sessionStorage, sessionId) : null;
  const previous = state ? currentWall(state) : [];
  const draft: Draft =
    edits?.forRound === rounds
      ? edits
      : stored?.forRound === rounds
        ? stored
        : { forRound: rounds, wall: [...previous], floorCount: 0 };
  const setDraft = (next: Draft | null) => {
    setEdits(next);
    writeDraft(sessionStorage, sessionId, next);
  };

  const save = useMutation({
    mutationFn: (vars: { state: AzulState; status: SessionStatus; then?: Draft }) => {
      if (!store) throw new Error('Store not ready');
      return store.save(
        {
          gameId: azul.id,
          status: vars.status,
          state: vars.state,
          stateVersion: azul.stateVersion,
        },
        sessionId,
      );
    },
    onSuccess: async (saved, vars) => {
      setDraft(vars.then ?? null);
      if (vars.status === 'completed') {
        await queryClient.invalidateQueries({ queryKey: sessionKeys.list(azul.id) });
        router.push(`/games/azul/history/${sessionId}`);
        return;
      }
      queryClient.setQueryData(key, saved);
    },
  });
  const offline = typeof navigator !== 'undefined' && !navigator.onLine;
  const saveError = save.isError && (
    <p className="text-danger" role="alert">
      {offline ? "You're offline." : "Couldn't save the round. Try again."}
    </p>
  );

  if (validId && (auth.status === 'loading' || query.isPending || (signedIn && completed))) {
    return (
      <Shell>
        <div aria-busy="true" className="flex flex-col gap-4">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="aspect-square w-full" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
        </div>
      </Shell>
    );
  }
  if (query.isError) {
    return (
      <Shell>
        <div className="flex flex-col gap-3" role="alert">
          <p>{offline ? "You're offline." : "Couldn't load this game. Try again."}</p>
          <Button variant="secondary" onClick={() => void query.refetch()}>
            Try Again
          </Button>
        </div>
        <BackToGames />
      </Shell>
    );
  }
  if (!validId || !session || !state || session.gameId !== azul.id) {
    return (
      <Shell>
        <p className="text-muted">
          {signedIn
            ? "This game isn't in your account."
            : "This game isn't on this device. Games in progress stay on the device they were started on until you sign in."}
        </p>
        <BackToGames />
      </Shell>
    );
  }

  const scores = scoreAzulRounds(state);
  const total = scores.at(-1)?.totalAfter ?? 0;
  const last = state.rounds.at(-1);
  const editLast = last
    ? () => {
        save.mutate({
          state: { rounds: state.rounds.slice(0, -1), finished: false },
          status: 'in_progress',
          then: { forRound: rounds - 1, wall: [...last.wall], floorCount: last.floorCount },
        });
      }
    : undefined;

  if (state.finished) {
    const breakdown = scoreAzul(state);
    const finalInput = {
      gameId: azul.id,
      status: 'completed' as const,
      state,
      stateVersion: azul.stateVersion,
    };
    const discardLocal = () => {
      removeInProgress(localStorage, [sessionId]);
      writeDraft(sessionStorage, sessionId, null);
      // Saving as completed removes a guest's game from this device.
      void store?.save(finalInput, sessionId);
    };
    return (
      <section className="flex flex-col gap-5 py-5">
        <h2 className="px-4 text-lg">Final Score</h2>
        <Breakdown state={state} breakdown={breakdown} {...(selectedKey ? { selectedKey } : {})} />
        <BreakdownList breakdown={breakdown} selectedKey={selectedKey} onSelect={setSelectedKey} />
        <div className="flex flex-col gap-2 px-4">
          {saveError}
          {signedIn && (
            <Button
              disabled={save.isPending}
              onClick={() => {
                save.mutate({ state, status: 'completed' });
              }}
            >
              {save.isPending ? 'Saving' : 'Save Game'}
            </Button>
          )}
          <Button variant="quiet" disabled={save.isPending} onClick={editLast}>
            Edit Last Round
          </Button>
        </div>
        {!signedIn && (
          <div className="flex flex-col gap-2">
            <SignInPrompt
              title="Save This Game"
              beforeSignIn={() => {
                setPendingSave(sessionStorage, { input: finalInput });
                discardLocal();
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
                  discardLocal();
                  router.push(AZUL_SCORE);
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

  const errors = checkAzulRound(previous, draft.wall);
  const errorCells = new Set(errors.flatMap((e) => e.cells.map((c) => squareKey(c.row, c.col))));
  const preview =
    errors.length === 0
      ? scoreAzulRounds({
          rounds: [...state.rounds, { wall: draft.wall, floorCount: draft.floorCount }],
        }).at(-1)
      : undefined;
  const confirm = (finished: boolean) => {
    save.mutate({
      state: {
        rounds: [...state.rounds, { wall: draft.wall, floorCount: draft.floorCount }],
        finished,
      },
      // A guest's finished game stays on the device until they save it or let it go.
      status: finished && signedIn ? 'completed' : 'in_progress',
    });
  };

  return (
    <Shell>
      <RoundStrip scores={scores} />
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg">Round {rounds + 1}</h2>
        <p className="text-muted tabular" data-testid="round-preview">
          {preview
            ? `This Round ${azulSignedPoints(preview.roundScore)}`
            : 'Check the chocolate box.'}
        </p>
      </div>
      <p className="text-muted">Tap the tiles you moved to your chocolate box this round.</p>
      <WallEditor
        previous={previous}
        wall={draft.wall}
        errorCells={errorCells}
        onChange={(wall) => {
          setDraft({ ...draft, wall });
        }}
      />
      {errors.length > 0 && (
        <ul className="flex flex-col gap-1 rounded-card bg-warn-soft px-3 py-2" role="alert">
          {errors.map((error) => (
            <li key={`${error.rule}-${error.cells.map((c) => squareKey(c.row, c.col)).join()}`}>
              {error.message}
            </li>
          ))}
        </ul>
      )}
      <h3 className="pt-1">Foundry Line</h3>
      <FoundryLine
        count={draft.floorCount}
        onChange={(floorCount) => {
          setDraft({ ...draft, floorCount });
        }}
      />
      <div className="flex items-baseline justify-between gap-3 border-t border-line pt-4">
        <span className="text-muted">Total after this round</span>
        <span className="font-display text-2xl tabular" data-testid="running-total">
          {points(preview?.totalAfter ?? total)}
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {saveError}
        <Button
          disabled={errors.length > 0 || save.isPending}
          onClick={() => {
            confirm(false);
          }}
        >
          {save.isPending ? 'Saving' : 'Confirm Round'}
        </Button>
        <Button
          variant="secondary"
          disabled={errors.length > 0 || save.isPending}
          onClick={() => {
            confirm(true);
          }}
        >
          Confirm Final Round
        </Button>
        {editLast && (
          <Button variant="quiet" disabled={save.isPending} onClick={editLast}>
            Edit Last Round
          </Button>
        )}
      </div>
    </Shell>
  );
}
