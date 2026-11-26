'use client';

import {
  addTap,
  MAX_PLAYERS,
  MIN_PLAYERS,
  openSeat,
  pickIndex,
  removePlayer,
  spinSteps,
  stepDelays,
  wedges,
  type Point,
  type TapRefusal,
} from '@tablekeeper/core';
import { useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { useOnMount } from '@/lib/hooks';
import { cn } from '@/lib/utils';

import {
  CENTER_RADIUS,
  SEAT_RADIUS,
  TABLE,
  TABLE_CENTER,
  toTablePoint,
  wedgeFill,
  wedgePath,
} from './table-geometry';

/** How long "Picking." shows before the winner when the device asks for reduced motion. */
const REDUCED_MOTION_PAUSE_MS = 600;
const LANDING_VIBRATION_MS = 30;

type Phase = 'joining' | 'spinning' | 'picking' | 'result';

/**
 * Who goes first (U1): each player taps where they sit, the table splits into a wedge per player,
 * and the spin button runs a roulette that lands on a winner drawn up front. Nothing is saved.
 */
export function FirstPlayerScreen() {
  const [players, setPlayers] = useState<Point[]>([]);
  const [phase, setPhase] = useState<Phase>('joining');
  /** Wedge position (in angle order) the roulette is on. */
  const [highlight, setHighlight] = useState<number | null>(null);
  /** Player index (in tap order) who goes first. */
  const [winner, setWinner] = useState<number | null>(null);
  const [refusal, setRefusal] = useState<TapRefusal | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useOnMount((signal) => {
    signal.addEventListener('abort', () => {
      if (timer.current !== null) clearTimeout(timer.current);
    });
  });

  const layout = wedges(players, TABLE_CENTER);
  const busy = phase === 'spinning' || phase === 'picking';

  function edit(next: Point[]) {
    setPlayers(next);
    setPhase('joining');
    setHighlight(null);
    setWinner(null);
    setRefusal(null);
  }

  function seat(point: Point) {
    if (busy) return;
    const result = addTap(players, point, { center: TABLE_CENTER, centerRadius: CENTER_RADIUS });
    if (result.ok) edit(result.value);
    else setRefusal(result.error);
  }

  function onTableClick(event: React.MouseEvent<HTMLDivElement>) {
    if (event.target instanceof Element && event.target.closest('button')) return;
    seat(toTablePoint(event, event.currentTarget.getBoundingClientRect()));
  }

  function spin() {
    if (busy || players.length < MIN_PLAYERS) return;
    const chosen = pickIndex(players.length, randomUint32);
    const target = layout.findIndex((wedge) => wedge.player === chosen);
    setWinner(null);
    setRefusal(null);

    const land = () => {
      timer.current = null;
      setHighlight(target);
      setWinner(chosen);
      setPhase('result');
      if ('vibrate' in navigator) navigator.vibrate(LANDING_VIBRATION_MS);
    };

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setPhase('picking');
      setHighlight(null);
      timer.current = setTimeout(land, REDUCED_MOTION_PAUSE_MS);
      return;
    }

    setPhase('spinning');
    const steps = spinSteps(layout.length, highlight ?? 0, target);
    const delays = stepDelays(steps.length);
    const step = (index: number) => {
      const position = steps[index];
      const delay = delays[index];
      if (position === undefined || delay === undefined) {
        land();
        return;
      }
      timer.current = setTimeout(() => {
        setHighlight(position);
        step(index + 1);
      }, delay);
    };
    step(0);
  }

  return (
    <div className="flex flex-col gap-4 px-4 py-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl">Who Goes First</h1>
        <p role="status" data-testid="first-player-status" className="min-h-7 text-lg">
          {statusText({ phase, count: players.length, winner, refusal })}
        </p>
      </div>

      <div
        data-testid="first-player-table"
        data-phase={phase}
        onClick={onTableClick}
        className="relative aspect-[5/6] w-full touch-manipulation overflow-hidden rounded-card border border-line bg-surface select-none"
      >
        <svg
          viewBox={`0 0 ${TABLE.width} ${TABLE.height}`}
          className="absolute inset-0 size-full"
          aria-hidden="true"
        >
          {layout.map((wedge, position) => {
            const active = phase === 'spinning' && highlight === position;
            const won = phase === 'result' && winner === wedge.player;
            return (
              <path
                key={wedge.player}
                data-testid="wedge"
                data-player={wedge.player + 1}
                data-active={active || undefined}
                data-winner={won || undefined}
                d={wedgePath(wedge)}
                fill={active || won ? 'var(--accent)' : wedgeFill(position, layout.length)}
                fillOpacity={active ? 0.55 : 1}
                stroke="var(--muted)"
                strokeOpacity={layout.length > 1 ? 0.6 : 0}
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
                className={cn(!busy && 'transition-colors duration-150 ease-calm')}
              />
            );
          })}
        </svg>

        <Button
          variant="secondary"
          size="small"
          className="sr-only absolute top-2 left-2 focus:not-sr-only"
          onClick={() => {
            seat(openSeat(players, TABLE_CENTER, SEAT_RADIUS));
          }}
          disabled={busy}
        >
          Add Player
        </Button>

        {players.map((point, index) => {
          const won = phase === 'result' && winner === index;
          return (
            <button
              key={`${point.x}:${point.y}`}
              type="button"
              aria-label={`Remove Player ${index + 1}`}
              disabled={busy}
              onClick={() => {
                edit(removePlayer(players, index));
              }}
              style={{
                left: `${(point.x / TABLE.width) * 100}%`,
                top: `${(point.y / TABLE.height) * 100}%`,
              }}
              className={cn(
                'tabular absolute flex size-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border text-lg font-bold transition-colors duration-150 ease-calm',
                won
                  ? 'border-2 border-on-accent bg-surface text-accent'
                  : 'border-ink/40 bg-surface text-ink',
              )}
            >
              {index + 1}
            </button>
          );
        })}

        <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
          {players.length === 0 ? (
            <p className="text-center text-lg">Each player taps where they sit.</p>
          ) : (
            // The surface behind keeps a disabled (translucent) button off the wedge colors.
            <div className="pointer-events-auto rounded-full bg-surface shadow-float">
              <Button
                variant={phase === 'result' ? 'secondary' : 'primary'}
                className="size-24 rounded-full px-0 text-base whitespace-normal"
                disabled={busy || players.length < MIN_PLAYERS}
                onClick={spin}
              >
                {phase === 'result' ? 'Spin Again' : 'Spin'}
              </Button>
            </div>
          )}
        </div>
      </div>

      {players.length > 0 && !busy && (
        <Button
          variant="secondary"
          className="self-start"
          onClick={() => {
            edit([]);
          }}
        >
          New Players
        </Button>
      )}
    </div>
  );
}

function statusText({
  phase,
  count,
  winner,
  refusal,
}: {
  phase: Phase;
  count: number;
  winner: number | null;
  refusal: TapRefusal | null;
}): string {
  if (phase === 'spinning') return 'Spinning.';
  if (phase === 'picking') return 'Picking.';
  if (phase === 'result' && winner !== null) return `Player ${winner + 1} goes first.`;
  if (refusal) {
    switch (refusal.reason) {
      case 'full':
        return `${MAX_PLAYERS} players is the most. Tap a number to remove that player.`;
      case 'center':
        return 'Tap nearer the edge, where you sit.';
      case 'too-close':
        return `Too close to player ${refusal.player + 1}. Tap nearer your own seat.`;
    }
  }
  if (count === 0) return 'Put the phone in the middle of the table.';
  if (count === 1) return '1 player. Spin needs at least 2.';
  return `${count} players. Tap a number to remove that player.`;
}

function randomUint32(): number {
  const [value] = crypto.getRandomValues(new Uint32Array(1));
  if (value === undefined) throw new Error('crypto.getRandomValues returned no value');
  return value;
}
