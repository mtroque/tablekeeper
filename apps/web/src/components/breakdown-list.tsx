'use client';

import type { ScoreBreakdown } from '@tablekeeper/core';

import { cn } from '@/lib/utils';

/**
 * The score total and one row per category. Tapping a row selects it, so the board
 * miniature can highlight where its points came from.
 */
export function BreakdownList({
  breakdown,
  selectedKey,
  onSelect,
}: {
  breakdown: ScoreBreakdown;
  selectedKey?: string | undefined;
  onSelect?: (key: string | undefined) => void;
}) {
  return (
    <section className="flex flex-col">
      <p className="text-center font-display text-5xl tabular" data-testid="score-total">
        {breakdown.total} {Math.abs(breakdown.total) === 1 ? 'Point' : 'Points'}
      </p>
      <ul className="mt-4 flex flex-col border-t border-line" aria-label="Score Breakdown">
        {breakdown.categories.map((row) => {
          const selected = row.key === selectedKey;
          return (
            <li key={row.key} className="border-b border-line">
              <button
                type="button"
                aria-pressed={selected}
                disabled={!onSelect}
                className={cn(
                  'flex min-h-11 w-full flex-col gap-0.5 px-4 py-2.5 text-left transition-colors duration-150 ease-calm',
                  selected && 'bg-accent-soft',
                )}
                onClick={() => onSelect?.(selected ? undefined : row.key)}
              >
                <span className="flex w-full items-baseline justify-between gap-3">
                  <span>{row.label}</span>
                  <span
                    className={cn('text-lg tabular', row.points < 0 && 'text-danger')}
                    data-testid={`category-${row.key}`}
                  >
                    {row.points}
                  </span>
                </span>
                {row.note && <span className="text-sm text-muted">{row.note}</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
