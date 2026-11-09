'use client';

import { hexKey, stackCode, stackName, type HarmoniesPiece, type HexCell } from '@tablekeeper/core';

import { cn } from '@/lib/utils';

/**
 * The stacks a photo can't tell apart, by top token, with their button labels
 * (docs/games/harmonies.md → Valid stacks: `M` asks 1/2/3, `L` asks 1/2/3, `T` asks 1/2, `R`
 * asks alone or on M/T/R). `W` and `F` never ask.
 */
const CHOICES: Partial<
  Record<HarmoniesPiece, { title: string; options: Array<[string, HarmoniesPiece[]]> }>
> = {
  M: {
    title: 'Mountain',
    options: [
      ['1', ['M']],
      ['2', ['M', 'M']],
      ['3', ['M', 'M', 'M']],
    ],
  },
  L: {
    title: 'Tree',
    options: [
      ['Leaves Only', ['L']],
      ['1 Trunk', ['T', 'L']],
      ['2 Trunks', ['T', 'T', 'L']],
    ],
  },
  T: {
    title: 'Trunks',
    options: [
      ['1', ['T']],
      ['2', ['T', 'T']],
    ],
  },
  R: {
    title: 'Roof',
    options: [
      ['Alone', ['R']],
      ['On Mountain', ['M', 'R']],
      ['On Trunk', ['T', 'R']],
      ['On Roof', ['R', 'R']],
    ],
  },
};

/**
 * "Set Heights": after a photo, one row per space whose height couldn't be seen, with a button
 * per stack its top token allows. Rows follow the space's current top, so a space changed to
 * water or a field drops out.
 */
export function HeightPrompts({
  cells,
  asks,
  stackAt,
  spaceName,
  onPick,
}: {
  /** The side's spaces, in layout order. */
  cells: readonly HexCell[];
  /** Whether the photo left this space's height to ask. */
  asks: (key: string) => boolean;
  stackAt: (cell: HexCell) => HarmoniesPiece[];
  spaceName: (cell: HexCell) => string;
  onPick: (cell: HexCell, stack: HarmoniesPiece[]) => void;
}) {
  const rows = cells.flatMap((cell) => {
    if (!asks(hexKey(cell.q, cell.r))) return [];
    const stack = stackAt(cell);
    const top = stack[stack.length - 1];
    const choices = top ? CHOICES[top] : undefined;
    return choices ? [{ cell, stack, choices }] : [];
  });
  if (rows.length === 0) return null;

  return (
    <section className="flex flex-col gap-3" aria-labelledby="set-heights">
      <div className="flex flex-col gap-1">
        <h3 id="set-heights" className="text-base font-semibold">
          Set Heights
        </h3>
        <p className="text-sm text-muted">
          A photo from above can&apos;t show how tall a stack is. Pick each one.
        </p>
      </div>
      <ul className="flex flex-col divide-y divide-line border-y border-line">
        {rows.map(({ cell, stack, choices }) => {
          const current = stackCode(stack);
          const name = spaceName(cell);
          return (
            <li
              key={hexKey(cell.q, cell.r)}
              className="flex flex-col gap-2 py-3"
              data-height-prompt={hexKey(cell.q, cell.r)}
            >
              <p className="text-[15px]">
                {name} <span className="text-muted">({choices.title})</span>
              </p>
              <div role="group" aria-label={`${name} height`} className="flex flex-wrap gap-2">
                {choices.options.map(([label, option]) => {
                  const selected = stackCode(option) === current;
                  return (
                    <button
                      key={label}
                      type="button"
                      aria-pressed={selected}
                      aria-label={`${name}: ${stackName(option)}`}
                      className={cn(
                        'min-h-11 min-w-11 rounded-control border border-line px-3 text-[15px] tabular transition-colors duration-150 ease-calm hover:bg-bg',
                        selected && 'border-accent bg-accent-soft font-semibold',
                      )}
                      onClick={() => {
                        onPick(cell, option);
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
