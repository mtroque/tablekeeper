'use client';

import {
  QuotaSchema,
  RULES_HISTORY_MAX_TURNS,
  RULES_QUESTION_MAX_LENGTH,
  RulesAnswerSchema,
  type Quota,
  type RulesTurn,
} from '@tablekeeper/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, ExternalLink, WifiOff } from 'lucide-react';
import { useState, useSyncExternalStore } from 'react';
import { toast } from 'sonner';

import { useAuth } from '@/components/auth-provider';
import { ChatThread, type ChatTurn } from '@/components/chat-thread';
import { QuotaPill } from '@/components/quota-pill';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';

import { blockerFromQuota, describeAskFailure, type Blocker } from './ask-errors';

type Props = { gameId: string; gameName: string; rulebookUrl: string; starters: string[] };

function subscribeOnline(callback: () => void) {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}

/** The last answered turns, flattened to at most 6 messages of context. */
function historyOf(turns: ChatTurn[]): RulesTurn[] {
  return turns
    .flatMap((turn): RulesTurn[] =>
      turn.status === 'answered'
        ? [
            { role: 'user', content: turn.question },
            { role: 'assistant', content: turn.answer.answer },
          ]
        : [],
    )
    .slice(-RULES_HISTORY_MAX_TURNS);
}

function resetTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function RulesAssistant({ gameId, gameName, rulebookUrl, starters }: Props) {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const online = useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
  const quotaKey = ['quota', auth.status] as const;
  const quota = useQuery({
    queryKey: quotaKey,
    queryFn: () => api().request('/v1/me/quota', { schema: QuotaSchema }),
    enabled: auth.status !== 'loading',
  });
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [draft, setDraft] = useState('');
  const [askBlocker, setAskBlocker] = useState<Blocker | null>(null);

  const ask = useMutation({
    mutationFn: (input: { question: string; history: RulesTurn[] }) =>
      api().request(`/v1/games/${gameId}/rules/ask`, {
        method: 'POST',
        body: input,
        schema: RulesAnswerSchema,
      }),
  });

  function send(question: string, replacing?: string) {
    const id = replacing ?? crypto.randomUUID();
    const history = historyOf(turns.filter((turn) => turn.id !== id));
    setTurns((all) => [
      ...all.filter((turn) => turn.id !== id),
      { id, question, status: 'pending' },
    ]);
    ask.mutate(
      { question, history },
      {
        onSuccess: (answer) => {
          queryClient.setQueryData<Quota>(quotaKey, answer.quota);
          setTurns((all) =>
            all.map((turn) =>
              turn.id === id ? { id, question, status: 'answered', answer } : turn,
            ),
          );
        },
        onError: (error) => {
          const failure = describeAskFailure(error, auth.status === 'signed-in');
          if (failure.kind === 'blocked') {
            // The question stays in the box so it can be asked once the block lifts.
            setTurns((all) => all.filter((turn) => turn.id !== id));
            setDraft(question);
            setAskBlocker(failure.blocker);
            void queryClient.invalidateQueries({ queryKey: ['quota'] });
            return;
          }
          setTurns((all) =>
            all.map((turn) =>
              turn.id === id ? { id, question, status: 'failed', ...failure } : turn,
            ),
          );
        },
      },
    );
  }

  const blocker = askBlocker ?? blockerFromQuota(quota.data);
  const busy = ask.isPending;
  const question = draft.trim();
  const canAsk = online && !blocker && !busy && question.length > 0;

  return (
    <div className="flex flex-1 flex-col gap-5 px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <a
          href={rulebookUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-accent underline-offset-4 hover:underline"
          data-testid="rulebook-link"
        >
          <BookOpen aria-hidden="true" className="size-4 stroke-[1.5]" />
          Official Rulebook
          <ExternalLink aria-hidden="true" className="size-3.5 stroke-[1.5]" />
        </a>
        <QuotaPill quota={quota.data} loading={quota.isPending} />
      </div>

      {turns.length === 0 && !blocker ? (
        <section className="flex flex-col gap-3" data-testid="rules-empty">
          <p className="text-muted">
            Ask about the {gameName} rules. Answers come from the official rulebook, with the pages
            to check.
          </p>
          <ul className="flex flex-col gap-2" aria-label="Starter questions">
            {starters.map((starter) => (
              <li key={starter}>
                <button
                  type="button"
                  disabled={!online || busy}
                  onClick={() => {
                    send(starter);
                  }}
                  className="min-h-11 w-full rounded-control border border-line bg-surface px-4 py-2 text-left text-ink transition-colors duration-150 ease-calm hover:border-accent disabled:opacity-50"
                >
                  {starter}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {turns.length > 0 ? (
        <ChatThread
          turns={turns}
          onRetry={(turn) => {
            send(turn.question, turn.id);
          }}
        />
      ) : null}

      <div className="mt-auto flex flex-col gap-3">
        {blocker ? (
          <BlockerNotice
            blocker={blocker}
            rulebookUrl={rulebookUrl}
            signIn={
              auth.status === 'guest'
                ? () => {
                    auth.signInWithGoogle().catch(() => {
                      toast.error("Couldn't start Google sign-in. Try again.");
                    });
                  }
                : undefined
            }
          />
        ) : null}
        {!online ? (
          <p
            role="status"
            className="flex items-center gap-2 text-sm text-muted"
            data-testid="rules-offline"
          >
            <WifiOff aria-hidden="true" className="size-4 stroke-[1.5]" />
            You&apos;re offline. Rules answers need a connection.
          </p>
        ) : null}
        {blocker?.kind === 'disabled' || blocker?.kind === 'missing' ? null : (
          <form
            className="flex flex-col gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (!canAsk) return;
              setDraft('');
              send(question);
            }}
          >
            <label htmlFor="rules-question" className="sr-only">
              Your question
            </label>
            <textarea
              id="rules-question"
              rows={2}
              maxLength={RULES_QUESTION_MAX_LENGTH}
              value={draft}
              disabled={!online || Boolean(blocker) || busy}
              placeholder={`Ask about ${gameName}`}
              onChange={(event) => {
                setDraft(event.target.value);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
              className="w-full resize-none rounded-control border border-line bg-surface px-3 py-2.5 text-ink placeholder:text-muted disabled:opacity-60"
            />
            <div className="flex items-center justify-between gap-3">
              <span className="tabular text-sm text-muted" aria-live="polite">
                {draft.length > RULES_QUESTION_MAX_LENGTH - 50
                  ? `${RULES_QUESTION_MAX_LENGTH - draft.length} characters left`
                  : ''}
              </span>
              <Button type="submit" disabled={!canAsk}>
                Ask
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function BlockerNotice({
  blocker,
  rulebookUrl,
  signIn,
}: {
  blocker: Blocker;
  rulebookUrl: string;
  signIn: (() => void) | undefined;
}) {
  const rulebook = (
    <a
      href={rulebookUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="font-semibold text-accent underline underline-offset-4"
    >
      official rulebook
    </a>
  );
  switch (blocker.kind) {
    case 'disabled':
      return (
        <p
          role="status"
          data-testid="rules-disabled"
          className="rounded-card border border-line bg-surface p-4 text-ink"
        >
          Rules answers are switched off right now. The {rulebook} has everything in the meantime.
        </p>
      );
    case 'missing':
      return (
        <p
          role="status"
          data-testid="rules-missing"
          className="rounded-card border border-line bg-surface p-4 text-ink"
        >
          This rulebook isn&apos;t loaded yet. Read the {rulebook} for now.
        </p>
      );
    case 'quota':
      if (blocker.scope === 'global') {
        return (
          <p
            role="status"
            data-testid="rules-quota"
            className="rounded-card border border-warn/40 bg-warn-soft p-4 text-ink"
          >
            Rules answers have reached their limit for today. Try again tomorrow, or check the{' '}
            {rulebook}.
          </p>
        );
      }
      return (
        <div
          role="status"
          data-testid="rules-quota"
          className="flex flex-col items-start gap-3 rounded-card border border-warn/40 bg-warn-soft p-4 text-ink"
        >
          <p>
            No questions left today.{' '}
            {signIn
              ? 'Sign in for more questions each day.'
              : blocker.resetsAt
                ? `More at ${resetTime(blocker.resetsAt)}.`
                : 'More tomorrow.'}
          </p>
          {signIn ? <Button onClick={signIn}>Sign In with Google</Button> : null}
        </div>
      );
  }
}
