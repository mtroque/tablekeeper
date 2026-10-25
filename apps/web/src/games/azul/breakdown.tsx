import {
  AzulStateSchema,
  currentWall,
  parseSquareKey,
  WALL_LAYOUT,
  wallColor,
  wallIndex,
} from '@tablekeeper/core';

import { BoardMiniature } from '@/components/board-miniature';

import type { BreakdownProps } from '../types';

import { TILE_FILL } from './colors';

/** The final chocolate box, with the selected round's tiles or bonus lines highlighted. */
export function Breakdown({ state, breakdown, selectedKey }: BreakdownProps<unknown>) {
  const parsed = AzulStateSchema.safeParse(state);
  const wall = parsed.success ? currentWall(parsed.data) : [];
  const highlights = breakdown.categories.find((row) => row.key === selectedKey)?.highlights;
  return (
    <div className="mx-auto w-48">
      <BoardMiniature
        board={{ kind: 'square', layout: WALL_LAYOUT }}
        label={`Chocolate box with ${wall.filter(Boolean).length} of 25 tiles`}
        highlights={highlights}
        cellFill={(key) => {
          const { row, col } = parseSquareKey(key);
          return wall[wallIndex(row, col)] ? TILE_FILL[wallColor(row, col)] : 'var(--surface)';
        }}
      />
    </div>
  );
}
