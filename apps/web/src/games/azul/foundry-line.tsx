'use client';

import { azulSignedPoints, FLOOR_PENALTIES } from '@tablekeeper/core';

import { cn } from '@/lib/utils';

/**
 * The 7 foundry line slots with their penalties. Tapping a slot fills the line up to it;
 * tapping the last filled slot empties it.
 */
export function FoundryLine({
  count,
  onChange,
}: {
  count: number;
  onChange: (count: number) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div role="group" aria-label="Foundry Line" className="grid grid-cols-7 gap-1">
        {FLOOR_PENALTIES.map((penalty, i) => {
          const filled = i < count;
          return (
            <button
              key={i}
              type="button"
              aria-pressed={filled}
              aria-label={`Foundry line slot ${i + 1}, ${penalty} points: ${filled ? 'filled' : 'empty'}`}
              data-slot-index={i}
              className={cn(
                'flex min-h-11 flex-col items-center justify-center gap-1 rounded-control border py-1.5 transition-colors duration-150 ease-calm',
                filled ? 'border-danger/50 bg-danger/10' : 'border-line bg-surface',
              )}
              onClick={() => {
                onChange(count === i + 1 ? i : i + 1);
              }}
            >
              <span
                aria-hidden
                className={cn(
                  'size-4 rounded-[3px] border',
                  filled ? 'border-danger bg-danger' : 'border-line',
                )}
              />
              <span className="text-sm text-muted tabular">{azulSignedPoints(penalty)}</span>
            </button>
          );
        })}
      </div>
      <p className="text-sm text-muted">The starting player marker counts as a tile here.</p>
    </div>
  );
}
