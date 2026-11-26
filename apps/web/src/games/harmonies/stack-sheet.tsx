'use client';

import type { HarmoniesPiece } from '@tablekeeper/core';
import { useState } from 'react';

import { hexPolygon } from '@/components/hex-grid-editor';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

import { SPACE_EDGE, SPACE_FILL, StackTokens } from './pieces';
import {
  isPicked,
  pickedStack,
  STACK_OPTIONS,
  type StackOption,
  type TopChoices,
} from './stack-options';

function StackPreview({ stack }: { stack: readonly HarmoniesPiece[] }) {
  return (
    <svg viewBox="-12 -12 24 24" className="size-11 shrink-0" aria-hidden="true">
      <polygon
        points={hexPolygon(0, 0, 11)}
        fill={SPACE_FILL}
        stroke={SPACE_EDGE}
        strokeWidth={0.6}
      />
      <StackTokens stack={stack} cx={0} cy={0} size={11} />
    </svg>
  );
}

function OptionButton({
  choice,
  label,
  current,
  onPick,
}: {
  choice: StackOption;
  label: string;
  current: readonly HarmoniesPiece[];
  onPick: (stack: HarmoniesPiece[]) => void;
}) {
  const stack = pickedStack(choice, current);
  const selected = isPicked(choice, current);
  return (
    <li>
      <button
        type="button"
        aria-pressed={selected}
        // The short photo labels ("2") are read with the stack they stand for.
        aria-label={choice.label}
        data-stack={choice.id}
        className={cn(
          'flex min-h-14 w-full items-center gap-2 rounded-control border border-line px-2 py-1 text-left text-sm transition-colors duration-150 ease-calm hover:bg-bg',
          selected && 'border-accent bg-accent-soft',
        )}
        onClick={() => {
          onPick(stack);
        }}
      >
        <StackPreview stack={stack} />
        <span className="tabular">{label}</span>
      </button>
    </li>
  );
}

/**
 * Bottom sheet for one space: pick its stack, bottom to top, from one option per score-equivalent
 * group of valid stacks. With `choices` (a top read from a photo) it opens on the stacks that top
 * leaves open, with "Something Else" for the full list.
 */
export function StackSheet({
  space,
  current,
  choices,
  onPick,
  onClose,
}: {
  /** The space's name, e.g. "Column 2, Space 3"; the sheet is closed while null. */
  space: string | null;
  current: readonly HarmoniesPiece[];
  choices: TopChoices | null;
  onPick: (stack: HarmoniesPiece[]) => void;
  onClose: () => void;
}) {
  // Cleared whenever the sheet closes, so every space opens on its choices.
  const [fullList, setFullList] = useState(false);
  const shown = choices && !fullList ? choices : null;
  const pick = (stack: HarmoniesPiece[]) => {
    setFullList(false);
    onPick(stack);
  };

  return (
    <Sheet
      open={space !== null}
      onOpenChange={(open) => {
        if (open) return;
        setFullList(false);
        onClose();
      }}
    >
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{space}</SheetTitle>
          <SheetDescription>
            {shown
              ? `The photo shows a ${shown.color} top. A photo from above can't show what is under it.`
              : 'Pick the stack on this space, bottom to top.'}
          </SheetDescription>
        </SheetHeader>
        {shown ? (
          <div className="flex flex-col gap-3">
            <ul className="grid grid-cols-2 gap-2" aria-label="Stacks">
              {shown.options.map((choice) => (
                <OptionButton
                  key={choice.id}
                  choice={choice}
                  label={choice.short}
                  current={current}
                  onPick={pick}
                />
              ))}
            </ul>
            <Button
              variant="quiet"
              className="self-start"
              onClick={() => {
                setFullList(true);
              }}
            >
              Something Else
            </Button>
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-2" aria-label="Stacks">
            {STACK_OPTIONS.map((choice) => (
              <OptionButton
                key={choice.id}
                choice={choice}
                label={choice.label}
                current={current}
                onPick={pick}
              />
            ))}
          </ul>
        )}
      </SheetContent>
    </Sheet>
  );
}
