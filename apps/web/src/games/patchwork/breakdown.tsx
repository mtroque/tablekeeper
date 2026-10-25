import { PATCHWORK_LAYOUT, PatchworkStateSchema, parseSquareKey } from '@tablekeeper/core';

import { BoardMiniature } from '@/components/board-miniature';

import type { BreakdownProps } from '../types';

import { BOARD_COLORS, BOARD_NAMES, CHOCOLATE } from './colors';

/** The box board as a miniature; selecting Empty Spaces highlights the spaces that cost points. */
export function Breakdown({ state, breakdown, selectedKey }: BreakdownProps<unknown>) {
  const parsed = PatchworkStateSchema.safeParse(state);
  if (!parsed.success) return null;
  const { board, grid } = parsed.data;
  const empty = grid.filter((covered) => !covered).length;
  const highlights = breakdown.categories.find((row) => row.key === selectedKey)?.highlights;
  return (
    <div
      className="mx-auto w-48 rounded-control p-1"
      style={{ backgroundColor: BOARD_COLORS[board].frame }}
    >
      <BoardMiniature
        board={{ kind: 'square', layout: PATCHWORK_LAYOUT }}
        label={`${BOARD_NAMES[board]} box board with ${empty} empty ${empty === 1 ? 'space' : 'spaces'}`}
        highlights={highlights}
        cellFill={(key) => {
          const { row, col } = parseSquareKey(key);
          return grid[row * 9 + col] ? CHOCOLATE.piece : BOARD_COLORS[board].space;
        }}
      />
    </div>
  );
}
