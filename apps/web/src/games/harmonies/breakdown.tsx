import { HARMONIES_LAYOUTS, HarmoniesStateSchema } from '@tablekeeper/core';

import { BoardMiniature } from '@/components/board-miniature';

import type { BreakdownProps } from '../types';

import { PIECE_COLORS, SPACE_FILL } from './pieces';

/** The board in top colors, with the selected category's spaces highlighted. */
export function Breakdown({ state, breakdown, selectedKey }: BreakdownProps<unknown>) {
  const parsed = HarmoniesStateSchema.safeParse(state);
  if (!parsed.success) return null;
  const { side, stacks } = parsed.data;
  const highlights = breakdown.categories.find((row) => row.key === selectedKey)?.highlights;
  return (
    <div className="mx-auto w-60">
      <BoardMiniature
        board={{ kind: 'hex', layout: HARMONIES_LAYOUTS[side] }}
        label={`Side ${side} board with ${Object.keys(stacks).length} spaces filled`}
        highlights={highlights}
        cellFill={(key) => {
          const top = stacks[key]?.at(-1);
          return top ? PIECE_COLORS[top] : SPACE_FILL;
        }}
      />
    </div>
  );
}
