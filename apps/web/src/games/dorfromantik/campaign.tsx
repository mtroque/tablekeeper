'use client';

import {
  campaignSummary,
  dorfromantik,
  extraRow,
  MAX_RED_HEARTS,
  undoUnlock,
  unlockable,
  type DorfromantikCampaign,
} from '@tablekeeper/core';
import Link from 'next/link';
import { useState } from 'react';

import { useAuth } from '@/components/auth-provider';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import { LoadError, SheetSkeleton } from './states';
import { useCampaign } from './use-campaign';
import { useSheetFlow } from './use-sheet';

const GAME = `/games/${dorfromantik.id}`;

type Entry = DorfromantikCampaign['unlockLog'][number];

function entryName(entry: Entry): string {
  return entry.id === 'DOR-U-REDHEART' ? 'Red Heart' : unlockable(entry.id).name;
}

/** Shown only once unlocked, so the picker stays spoiler-safe. */
function entryDetail(entry: Entry): string | null {
  const { row } = unlockable(entry.id);
  return row ? `Adds the ${extraRow(row).label} row to the scoresheet.` : null;
}

function Stat({ label, value, testId }: { label: string; value: string; testId: string }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="font-display text-2xl tabular" data-testid={testId}>
        {value}
      </dd>
    </div>
  );
}

/** Games played, high score and rank, and the unlocks with the game each came in. */
export function Campaign() {
  const auth = useAuth();
  const { query, save, start } = useCampaign();
  const { update: updateFlow } = useSheetFlow();
  const [undoing, setUndoing] = useState<number | null>(null);
  const [starting, setStarting] = useState(false);

  if (query.isPending) return <SheetSkeleton />;
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
  const summary = campaignSummary(campaign);
  const pending = undoing === null ? undefined : campaign.unlockLog[undoing];

  if (summary.gamesPlayed === 0 && campaign.unlockLog.length === 0) {
    return (
      <section className="flex flex-col items-center gap-3 px-4 py-10 text-center">
        <p>No games in this campaign yet. Your first game starts it.</p>
        <Button asChild>
          <Link href={`${GAME}/score`}>Score a Game</Link>
        </Button>
      </section>
    );
  }

  return (
    <div className="flex flex-col">
      <section className="flex flex-col gap-4 border-b border-line px-4 py-5">
        <h2 className="text-lg">Campaign</h2>
        <dl className="grid grid-cols-3 gap-3">
          <Stat label="Games Played" value={String(summary.gamesPlayed)} testId="games-played" />
          <Stat
            label="High Score"
            value={summary.highScore === null ? 'None' : String(summary.highScore)}
            testId="high-score"
          />
          <Stat label="Rank" value={summary.rank?.title ?? 'None'} testId="rank-title" />
        </dl>
        {auth.status === 'guest' && (
          <p className="text-sm text-muted">This campaign is kept on this device only.</p>
        )}
      </section>

      <section className="flex flex-col gap-3 px-4 py-5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-lg">Unlocks</h2>
          {campaign.redHearts > 0 && (
            <p className="text-sm text-muted" data-testid="red-hearts">
              Red Hearts ({campaign.redHearts} of {MAX_RED_HEARTS})
            </p>
          )}
        </div>
        {campaign.unlockLog.length === 0 ? (
          <p className="text-muted">Nothing unlocked yet. Unlocks are added after each game.</p>
        ) : (
          <ul className="flex flex-col" aria-label="Unlocks">
            {campaign.unlockLog.map((entry, i) => {
              const detail = entryDetail(entry);
              return (
                <li
                  key={`${entry.id}-${i}`}
                  className="flex items-center justify-between gap-3 border-b border-line py-3"
                >
                  <div className="flex flex-col">
                    <span>{entryName(entry)}</span>
                    <span className="text-sm text-muted">
                      Game {entry.gameNumber}
                      {detail ? `. ${detail}` : ''}
                    </span>
                  </div>
                  <Button
                    variant="quiet"
                    size="small"
                    aria-label={`Undo ${entryName(entry)} from game ${entry.gameNumber}`}
                    onClick={() => {
                      save.reset();
                      setUndoing(i);
                    }}
                  >
                    Undo
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3 border-t border-line px-4 py-5">
        <Button
          variant="secondary"
          onClick={() => {
            start.reset();
            setStarting(true);
          }}
        >
          Start New Campaign
        </Button>
      </section>

      <Dialog open={starting} onOpenChange={setStarting}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start a new campaign?</DialogTitle>
            <DialogDescription>
              {auth.status === 'guest'
                ? 'This campaign and its unlocks are cleared from this device. The next game is game 1 with nothing unlocked.'
                : 'This campaign is archived with its games. The next game is game 1 with nothing unlocked.'}
            </DialogDescription>
          </DialogHeader>
          {start.isError && (
            <p className="text-danger" role="alert">
              Couldn&apos;t start a new campaign. Try again.
            </p>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary">Keep Playing</Button>
            </DialogClose>
            <Button
              variant="danger"
              disabled={start.isPending}
              onClick={() => {
                start.mutate(undefined, {
                  onSuccess: () => {
                    updateFlow({ sheet: null, finished: null });
                    setStarting(false);
                  },
                });
              }}
            >
              Start New Campaign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={pending !== undefined}
        onOpenChange={(open) => {
          if (!open) setUndoing(null);
        }}
      >
        {pending && (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Undo {entryName(pending)}?</DialogTitle>
              <DialogDescription>
                Only future games change. Saved games keep their scores.
              </DialogDescription>
            </DialogHeader>
            {save.isError && (
              <p className="text-danger" role="alert">
                Couldn&apos;t undo that. Try again.
              </p>
            )}
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="secondary">Keep It</Button>
              </DialogClose>
              <Button
                variant="danger"
                disabled={save.isPending}
                onClick={() => {
                  if (undoing === null) return;
                  save.mutate(undoUnlock(campaign, undoing), {
                    onSuccess: () => {
                      setUndoing(null);
                    },
                  });
                }}
              >
                Undo Unlock
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
