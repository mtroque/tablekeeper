import { EXAMPLE_LAYOUT, ExampleStateSchema, parseSquareKey } from '@tablekeeper/core';

import { BoardMiniature } from '@/components/board-miniature';

import type { BreakdownProps } from '../types';

/** The board as a miniature, with the selected category's cells highlighted. */
export function Breakdown({ state, breakdown, selectedKey }: BreakdownProps<unknown>) {
  const parsed = ExampleStateSchema.safeParse(state);
  const cells = parsed.success ? parsed.data.cells : [];
  const highlights = breakdown.categories.find((row) => row.key === selectedKey)?.highlights;
  return (
    <div className="mx-auto w-40">
      <BoardMiniature
        board={{ kind: 'square', layout: EXAMPLE_LAYOUT }}
        label={`Board with ${cells.filter(Boolean).length} of 9 cells covered`}
        highlights={highlights}
        cellFill={(key) => {
          const { row, col } = parseSquareKey(key);
          return cells[row * 3 + col] ? 'var(--accent)' : 'var(--surface)';
        }}
      />
    </div>
  );
}
