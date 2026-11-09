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
 * a filled one asks first, because the two sides have different spaces. A board from a photo can
 * also be read again as the other side.
 */
export function SideSwitch({
  side,
  boardEmpty,
  onSwitch,
  onReread,
}: {
  side: HarmoniesSide;
  boardEmpty: boolean;
  /** Switches to `next`, clearing the board when it wasn't empty. */
  onSwitch: (next: HarmoniesSide) => void;
  /** Rereads the photo as `next`; false when it couldn't. Absent unless the board is from a photo. */
  onReread?: ((next: HarmoniesSide) => Promise<boolean>) | undefined;
}) {
  const [pending, setPending] = useState<HarmoniesSide | null>(null);
  const [rereading, setRereading] = useState(false);
  const [rereadFailed, setRereadFailed] = useState(false);
  const close = () => {
    setPending(null);
    setRereadFailed(false);
  };
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
          if (!open && !rereading) close();
        }}
      >
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Switch to Side {pending}?</SheetTitle>
            <SheetDescription>
              {onReread
                ? `Side ${pending} has different spaces. Read your photo again as side ${pending}, or clear the board. Your cards stay.`
                : `Side ${pending} has different spaces, so the board is cleared. Your cards stay.`}
            </SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-2">
            {onReread && (
              <Button
                disabled={rereading}
                onClick={() => {
                  if (!pending) return;
                  setRereading(true);
                  setRereadFailed(false);
                  void onReread(pending).then((ok) => {
                    setRereading(false);
                    if (ok) close();
                    else setRereadFailed(true);
                  });
                }}
              >
                {rereading ? 'Reading the photo again.' : `Reread Photo as Side ${pending}`}
              </Button>
            )}
            {rereadFailed && (
              <p role="alert" className="text-[15px] text-danger">
                Couldn&apos;t read the photo again. Clear the board or cancel.
              </p>
            )}
            <Button
              variant="danger"
              disabled={rereading}
              onClick={() => {
                if (pending) onSwitch(pending);
                close();
              }}
            >
              Clear Board
            </Button>
            <Button variant="secondary" disabled={rereading} onClick={close}>
              Cancel
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
