'use client';

import { Minus, Plus } from 'lucide-react';
import { useRef, useState } from 'react';

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

const LONG_PRESS_MS = 500;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** − / + stepper; a long press on the value (or Enter on it) switches to typing a number. */
export function Counter({
  label,
  value,
  onChange,
  min = 0,
  max = 999,
  uncertain = false,
  className,
}: CounterProps) {
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState('');
  const pressTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const startTyping = () => {
    setDraft(String(value));
    setTyping(true);
  };
  const commit = () => {
    const parsed = Number.parseInt(draft, 10);
    if (Number.isFinite(parsed)) onChange(clamp(parsed, min, max));
    setTyping(false);
  };
  const cancelPress = () => {
    clearTimeout(pressTimer.current);
  };

  return (
    <div className={cn('flex items-center justify-between gap-3', className)}>
      <span className="text-[15px]">{label}</span>
      <div className="flex items-center gap-1">
        <Button
          variant="secondary"
          size="icon"
          aria-label={`Decrease ${label}`}
          disabled={value <= min}
          onClick={() => {
            onChange(clamp(value - 1, min, max));
          }}
        >
          <Minus />
        </Button>
        {typing ? (
          <input
            aria-label={label}
            className="h-11 w-14 rounded-control border border-accent bg-surface text-center text-lg tabular"
            inputMode="numeric"
            // Typing mode is entered on purpose, so moving focus here is expected.
            autoFocus
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value.replace(/[^0-9-]/g, ''));
            }}
            onBlur={commit}
            onKeyDown={(event) => {
              if (event.key === 'Enter') commit();
              if (event.key === 'Escape') setTyping(false);
            }}
          />
        ) : (
          <button
            type="button"
            aria-label={`${label}: ${value}. Hold to type a number.`}
            className={cn(
              'h-11 w-14 rounded-control text-center text-lg tabular select-none',
              uncertain && 'outline-2 outline-offset-[-2px] outline-warn outline-dashed',
            )}
            onPointerDown={() => {
              pressTimer.current = setTimeout(startTyping, LONG_PRESS_MS);
            }}
            onPointerUp={cancelPress}
            onPointerLeave={cancelPress}
            onKeyDown={(event) => {
              if (event.key === 'Enter') startTyping();
            }}
          >
            {value}
          </button>
        )}
        <Button
          variant="secondary"
          size="icon"
          aria-label={`Increase ${label}`}
          disabled={value >= max}
          onClick={() => {
            onChange(clamp(value + 1, min, max));
          }}
        >
          <Plus />
        </Button>
      </div>
    </div>
  );
}
