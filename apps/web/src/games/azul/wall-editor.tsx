'use client';

import { squareKey, WALL_LAYOUT, wallColor, wallIndex, type SquareCell } from '@tablekeeper/core';

import { SquareGridEditor } from '@/components/square-grid-editor';

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
          const placed = space === 'earlier' || space === 'new';
          const fill = TILE_FILL[wallColor(cell.row, cell.col)];
          return (
            <span
              data-space={space}
              className="absolute inset-0 flex items-center justify-center rounded-control"
            >
              {/* The printed chocolate: faint until a tile covers it. */}
              <span
                aria-hidden
                className="absolute inset-0 rounded-control"
                style={{ backgroundColor: fill, opacity: placed ? 1 : 0.28 }}
              />
              {placed && (
                <span
                  aria-hidden
                  className="relative size-3/5 rounded-[4px] border-2"
                  style={{ borderColor: `${TILE_EDGE}66`, backgroundColor: fill }}
                />
              )}
              {space === 'new' && (
                <span
                  aria-hidden
                  className="absolute inset-0.5 rounded-[5px] border-3 border-accent"
                />
              )}
              {error && (
                <span
                  aria-hidden
                  className="absolute inset-0 rounded-control border-3 border-dashed border-danger"
                />
              )}
            </span>
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
