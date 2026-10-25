'use client';

import {
  HARMONIES_STACKS,
  stackCode,
  stackName,
  stackPieces,
  type HarmoniesPiece,
} from '@tablekeeper/core';

import { hexPolygon } from '@/components/hex-grid-editor';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

import { SPACE_EDGE, SPACE_FILL, StackTokens } from './pieces';

// Empty first, then every valid stack (`HAR-STACK-5`: nothing else is offered).
const OPTIONS: ReadonlyArray<readonly HarmoniesPiece[]> = [
  [],
  ...HARMONIES_STACKS.map(stackPieces),
];

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

/** Bottom sheet for one space: pick its stack, bottom to top, from the valid ones only. */
export function StackSheet({
  space,
  current,
  onPick,
  onClose,
}: {
  /** The space's name, e.g. "Column 2, Space 3"; the sheet is closed while null. */
  space: string | null;
  current: readonly HarmoniesPiece[];
  onPick: (stack: HarmoniesPiece[]) => void;
  onClose: () => void;
}) {
  const currentCode = stackCode(current);
  return (
    <Sheet
      open={space !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{space}</SheetTitle>
          <SheetDescription>Pick the stack on this space, bottom to top.</SheetDescription>
        </SheetHeader>
        <ul className="grid grid-cols-2 gap-2" aria-label="Stacks">
          {OPTIONS.map((stack) => {
            const code = stackCode(stack);
            const selected = code === currentCode;
            return (
              <li key={code || 'empty'}>
                <button
                  type="button"
                  aria-pressed={selected}
                  data-stack={code || 'empty'}
                  className={cn(
                    'flex min-h-14 w-full items-center gap-2 rounded-control border border-line px-2 py-1 text-left text-sm transition-colors duration-150 ease-calm hover:bg-bg',
                    selected && 'border-accent bg-accent-soft',
                  )}
                  onClick={() => {
                    onPick([...stack]);
                  }}
                >
                  <StackPreview stack={stack} />
                  <span>{stack.length === 0 ? 'Empty Space' : stackName(stack)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </SheetContent>
    </Sheet>
  );
}
