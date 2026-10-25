import type { RulesAnswer } from '@tablekeeper/core';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

import { CitationChip } from './citation-chip';

export type ChatTurn = {
  id: string;
  question: string;
} & (
  | { status: 'pending' }
  | { status: 'answered'; answer: RulesAnswer }
  | { status: 'failed'; message: string; retryable: boolean }
);

type Props = { turns: ChatTurn[]; onRetry: (turn: ChatTurn) => void };

/** Questions and rulebook answers, oldest first. */
export function ChatThread({ turns, onRetry }: Props) {
  return (
    <ol className="flex flex-col gap-5" aria-label="Questions and answers">
      {turns.map((turn) => (
        <li key={turn.id} className="flex flex-col gap-3">
          <p className="max-w-[85%] self-end rounded-card bg-accent-soft px-4 py-2.5 text-ink">
            {turn.question}
          </p>
          <TurnReply turn={turn} onRetry={onRetry} />
        </li>
      ))}
    </ol>
  );
}

function TurnReply({ turn, onRetry }: { turn: ChatTurn; onRetry: (turn: ChatTurn) => void }) {
  switch (turn.status) {
    case 'pending':
      return (
        <div role="status" className="flex flex-col gap-2" data-testid="answer-pending">
          <p className="text-sm text-muted">Reading the rulebook.</p>
          <Skeleton className="h-4 w-11/12" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      );
    case 'failed':
      return (
        <div
          role="alert"
          data-testid="answer-error"
          className="flex flex-col items-start gap-2 border-l-2 border-danger pl-3"
        >
          <p className="text-ink">{turn.message}</p>
          {turn.retryable ? (
            <Button
              variant="secondary"
              size="small"
              onClick={() => {
                onRetry(turn);
              }}
            >
              Try Again
            </Button>
          ) : null}
        </div>
      );
    case 'answered': {
      const { answer } = turn;
      if (answer.notCovered) {
        return (
          <section
            data-testid="answer-not-covered"
            className="flex flex-col gap-2 border-l-2 border-line pl-3 text-muted"
          >
            <h3 className="font-sans text-sm font-semibold">Not in the Rulebook</h3>
            <p>{answer.answer}</p>
            <p className="text-sm">
              The publisher&apos;s FAQ may cover questions the rulebook doesn&apos;t settle.
            </p>
            {answer.citations.length > 0 ? <Citations answer={answer} /> : null}
          </section>
        );
      }
      return (
        <section data-testid="answer" className="flex flex-col gap-2 border-l-2 border-accent pl-3">
          <h3 className="font-sans text-sm font-semibold text-muted">From the Rulebook</h3>
          <p className="whitespace-pre-line text-ink">{answer.answer}</p>
          <Citations answer={answer} />
        </section>
      );
    }
  }
}

function Citations({ answer }: { answer: RulesAnswer }) {
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Rulebook pages">
      {answer.citations.map((citation) => (
        <li key={citation.sectionId}>
          <CitationChip citation={citation} />
        </li>
      ))}
    </ul>
  );
}
