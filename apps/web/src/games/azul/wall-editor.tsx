'use client';

import { squareKey, WALL_LAYOUT, wallColor, wallIndex, type SquareCell } from '@tablekeeper/core';

import { SquareGridEditor } from '@/components/square-grid-editor';
import { cn } from '@/lib/utils';

import { BOX_FILL, TILE_EDGE, TILE_FILL, TILE_NAME } from './colors';

type Space = 'empty' | 'earlier' | 'new' | 'missing';

function spaceOf(previous: readonly boolean[], wall: readonly boolean[], cell: SquareCell): Space {
  const before = previous[wallIndex(cell.row, cell.col)] === true;
  const now = wall[wallIndex(cell.row, cell.col)] === true;
  if (before) return now ? 'earlier' : 'missing';
  return now ? 'new' : 'empty';
}

const SPOKEN: Record<Space, string> = {
  empty: 'empty',
  earlier: 'placed in an earlier round',
  new: 'new this round',
  missing: 'removed, it had a tile last round',
};

/**
 * The chocolate box for one round. Every space shows its printed chocolate: faint when empty,
 * solid once placed; this round's new tiles carry a ring. Tap a space to place or remove a tile.
 */
export function WallEditor({
  previous,
  wall,
  errorCells,
  onChange,
}: {
  previous: readonly boolean[];
  wall: readonly boolean[];
  /** `"row,col"` keys of spaces a round error is about. */
  errorCells: ReadonlySet<string>;
  onChange: (wall: boolean[]) => void;
}) {
  return (
    <div className="rounded-card p-2" style={{ backgroundColor: BOX_FILL }}>
      <SquareGridEditor
        layout={WALL_LAYOUT}
        label="Chocolate Box"
        className="gap-1.5"
        cellLabel={(cell) => {
          const color = TILE_NAME[wallColor(cell.row, cell.col)];
          return `Row ${cell.row + 1}, column ${cell.col + 1}, ${color}: ${SPOKEN[spaceOf(previous, wall, cell)]}`;
        }}
        renderCell={(cell) => {
          const space = spaceOf(previous, wall, cell);
          const error = errorCells.has(squareKey(cell.row, cell.col));
          return (
            <span
              data-space={space}
              className={cn(
                'absolute inset-0 rounded-control',
                space === 'new' && 'ring-3 ring-accent ring-inset',
                error && 'outline-2 outline-offset-[-2px] outline-danger outline-dashed',
              )}
              style={{
                backgroundColor: TILE_FILL[wallColor(cell.row, cell.col)],
                opacity: space === 'empty' || space === 'missing' ? 0.3 : 1,
                boxShadow: `inset 0 0 0 1px ${TILE_EDGE}55`,
              }}
            />
          );
        }}
        onTap={(ref) => {
          if (ref.kind !== 'square') return;
          const next = [...wall];
          const index = wallIndex(ref.row, ref.col);
          next[index] = !next[index];
          onChange(next);
        }}
      />
    </div>
  );
}
