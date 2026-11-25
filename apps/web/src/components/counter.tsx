'use client';

import { Minus, Plus } from 'lucide-react';
import { useId, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type CounterProps = {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  /** Draws the value in the low-confidence style. */
  uncertain?: boolean;
  className?: string;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Keeps only digits, plus one leading minus when `min` allows negative numbers. */
export function sanitizeCounterInput(text: string, min: number): string {
  const negative = min < 0 && text.trimStart().startsWith('-');
  const digits = text.replace(/\D/g, '');
  return negative ? `-${digits}` : digits;
}

function parseWhole(draft: string): number | null {
  if (!/^-?\d+$/.test(draft)) return null;
  const parsed = Number.parseInt(draft, 10);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

/**
 * The value to apply while typing, or null to wait for the commit: in range applies as is; a
 * number more digits can only push further out of range is clamped now; one more digits could
 * still bring into range (under a positive `min`, a lone "-") waits.
 */
export function liveCounterValue(draft: string, min: number, max: number): number | null {
  const parsed = parseWhole(draft);
  if (parsed === null) return null;
  if (parsed >= min && parsed <= max) return parsed;
  if (parsed > max && parsed > 0) return max;
  if (parsed < min && parsed < 0) return min;
  return null;
}

/** The value on blur or Enter: a whole number clamped to range, else `fallback` (the value before editing). */
export function commitCounterValue(
  draft: string,
  fallback: number,
  min: number,
  max: number,
): number {
  const parsed = parseWhole(draft);
  return parsed === null ? fallback : clamp(parsed, min, max);
}

/** − / + stepper around a number field: tap the value to type it (docs/UX.md → Review / editor). */
export function Counter({
  label,
  value,
  onChange,
  min = 0,
  max = 999,
  uncertain = false,
  className,
}: CounterProps) {
  const id = useId();
  // The text being typed, or null when the field shows `value`.
  const [draft, setDraft] = useState<string | null>(null);
  const startValue = useRef(value);
  const skipCommit = useRef(false);
  const keepSelection = useRef(false);

  const apply = (next: number) => {
    if (next !== value) onChange(next);
  };
  const step = (delta: number) => {
    setDraft(null);
    apply(clamp(value + delta, min, max));
  };

  return (
    <div className={cn('flex items-center justify-between gap-3', className)}>
      <label htmlFor={id} className="text-[15px]">
        {label}
      </label>
      <div className="flex items-center gap-1">
        <Button
          variant="secondary"
          size="icon"
          aria-label={`Decrease ${label}`}
          disabled={value <= min}
          onClick={() => {
            step(-1);
          }}
        >
          <Minus />
        </Button>
        <input
          id={id}
          type="text"
          inputMode="numeric"
          pattern={min < 0 ? '-?[0-9]*' : '[0-9]*'}
          enterKeyHint="done"
          autoComplete="off"
          className={cn(
            'h-11 w-16 rounded-control border border-line bg-surface text-center text-lg tabular transition-colors duration-150 ease-calm focus:border-accent',
            uncertain && 'outline-2 outline-offset-[-2px] outline-warn outline-dashed',
          )}
          value={draft ?? String(value)}
          onFocus={(event) => {
            startValue.current = value;
            setDraft(String(value));
            keepSelection.current = true;
            event.currentTarget.select();
          }}
          onMouseUp={(event) => {
            // The mouse up that focused the field would otherwise clear the selection.
            if (keepSelection.current) event.preventDefault();
            keepSelection.current = false;
          }}
          onChange={(event) => {
            keepSelection.current = false;
            const text = sanitizeCounterInput(event.target.value, min);
            const live = liveCounterValue(text, min, max);
            // A clamped number replaces what was typed, so the field shows what applies.
            const clamped = live !== null && live !== Number.parseInt(text, 10);
            setDraft(clamped ? String(live) : text);
            if (live !== null) apply(live);
          }}
          onBlur={() => {
            if (skipCommit.current) {
              skipCommit.current = false;
            } else if (draft !== null) {
              apply(commitCounterValue(draft, startValue.current, min, max));
            }
            setDraft(null);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.currentTarget.blur();
            } else if (event.key === 'Escape') {
              skipCommit.current = true;
              apply(startValue.current);
              event.currentTarget.blur();
            }
          }}
        />
        <Button
          variant="secondary"
          size="icon"
          aria-label={`Increase ${label}`}
          disabled={value >= max}
          onClick={() => {
            step(1);
          }}
        >
          <Plus />
        </Button>
      </div>
    </div>
  );
}
