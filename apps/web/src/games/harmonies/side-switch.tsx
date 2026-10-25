'use client';

import { HARMONIES_SIDES, type HarmoniesSide } from '@tablekeeper/core';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

/**
 * The board side dropdown (docs/UX.md → Board side switch). An empty board switches at once;
 * a filled one asks first, because the two sides have different spaces.
 */
export function SideSwitch({
  side,
  boardEmpty,
  onSwitch,
}: {
  side: HarmoniesSide;
  boardEmpty: boolean;
  /** Switches to `next`, clearing the board when it wasn't empty. */
  onSwitch: (next: HarmoniesSide) => void;
}) {
  const [pending, setPending] = useState<HarmoniesSide | null>(null);
  return (
    <>
      <label className="flex items-center justify-between gap-3">
        <span className="text-[15px]">Board Side</span>
        <select
          className="h-11 rounded-control border border-line bg-surface px-3 text-[15px] focus-visible:outline-2 focus-visible:outline-accent"
          value={side}
          onChange={(event) => {
            const next = event.target.value === 'B' ? 'B' : 'A';
            if (next === side) return;
            if (boardEmpty) onSwitch(next);
            else setPending(next);
          }}
        >
          {HARMONIES_SIDES.map((s) => (
            <option key={s} value={s}>
              Side {s}
            </option>
          ))}
        </select>
      </label>
      <Sheet
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
      >
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Switch to Side {pending}?</SheetTitle>
            <SheetDescription>
              Side {pending} has different spaces, so the board is cleared. Your cards stay.
            </SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-2">
            <Button
              variant="danger"
              onClick={() => {
                if (pending) onSwitch(pending);
                setPending(null);
              }}
            >
              Clear Board
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setPending(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
