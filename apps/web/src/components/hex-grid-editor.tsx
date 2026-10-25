'use client';

import {
  hexCenter,
  hexCorners,
  hexKey,
  hexRef,
  type CellRef,
  type HexCell,
  type HexLayout,
} from '@tablekeeper/core';
import { useMemo, useRef, useState } from 'react';

import { isLowConfidence } from '@/components/confidence-outline';
import { cn } from '@/lib/utils';

const SIZE = 10;

export type HexCellBox = { cx: number; cy: number; size: number };

/** Column and visual row of an axial cell (docs/games/harmonies.md → Coordinates). */
function toOffset({ q, r }: HexCell): { col: number; row: number } {
  return { col: q, row: r + Math.floor(q / 2) };
}

function fromOffset(col: number, row: number): HexCell {
  return { q: col, r: row - Math.floor(col / 2) };
}

export function hexViewBox(cells: readonly HexCell[], size: number): string {
  const xs = cells.map((c) => hexCenter(c, size).x);
  const ys = cells.map((c) => hexCenter(c, size).y);
  const h = (Math.sqrt(3) / 2) * size;
  const minX = Math.min(...xs) - size;
  const minY = Math.min(...ys) - h;
  return `${minX} ${minY} ${Math.max(...xs) + size - minX} ${Math.max(...ys) + h - minY}`;
}

export function hexPolygon(cx: number, cy: number, size: number): string {
  return hexCorners(cx, cy, size)
    .map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`)
    .join(' ');
}

/**
 * A flat-topped hex board drawn from a layout. The game draws each cell's contents in SVG
 * and names it; taps come back as `CellRef`s. Arrow keys move by column and visual row.
 */
export function HexGridEditor({
  layout,
  label,
  renderCell,
  cellLabel,
  onTap,
  confidence,
  className,
}: {
  layout: HexLayout;
  label: string;
  renderCell: (cell: HexCell, box: HexCellBox) => React.ReactNode;
  cellLabel: (cell: HexCell) => string;
  onTap: (ref: CellRef) => void;
  confidence?: Record<string, number> | undefined;
  className?: string;
}) {
  const keys = useMemo(() => new Set(layout.cells.map((c) => hexKey(c.q, c.r))), [layout]);
  const [focusKey, setFocusKey] = useState(() => {
    const first = layout.cells[0];
    return first ? hexKey(first.q, first.r) : '';
  });
  const refs = useRef(new Map<string, SVGGElement>());

  const move = (cell: HexCell, dCol: number, dRow: number) => {
    const { col, row } = toOffset(cell);
    const target = fromOffset(col + dCol, row + dRow);
    const key = hexKey(target.q, target.r);
    if (!keys.has(key)) return;
    setFocusKey(key);
    refs.current.get(key)?.focus();
  };

  return (
    <svg
      role="group"
      aria-label={label}
      viewBox={hexViewBox(layout.cells, SIZE)}
      className={cn('w-full', className)}
    >
      {layout.cells.map((cell) => {
        const key = hexKey(cell.q, cell.r);
        const { x, y } = hexCenter(cell, SIZE);
        const low = isLowConfidence(confidence?.[key]);
        return (
          <g
            key={key}
            ref={(el) => {
              if (el) refs.current.set(key, el);
              else refs.current.delete(key);
            }}
            role="button"
            tabIndex={key === focusKey ? 0 : -1}
            aria-label={cellLabel(cell)}
            data-cell={key}
            data-low-confidence={low || undefined}
            className="cursor-pointer outline-none [&:focus-visible>polygon.hex-edge]:stroke-accent [&:focus-visible>polygon.hex-edge]:stroke-[1.5]"
            onFocus={() => {
              setFocusKey(key);
            }}
            onClick={() => {
              onTap(hexRef(cell.q, cell.r));
            }}
            onKeyDown={(event) => {
              const moves: Record<string, [number, number]> = {
                ArrowLeft: [-1, 0],
                ArrowRight: [1, 0],
                ArrowUp: [0, -1],
                ArrowDown: [0, 1],
              };
              const delta = moves[event.key];
              if (delta) {
                event.preventDefault();
                move(cell, ...delta);
              } else if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onTap(hexRef(cell.q, cell.r));
              }
            }}
          >
            <polygon points={hexPolygon(x, y, SIZE * 0.95)} fill="var(--surface)" />
            {renderCell(cell, { cx: x, cy: y, size: SIZE * 0.95 })}
            <polygon
              className="hex-edge"
              points={hexPolygon(x, y, SIZE * 0.95)}
              fill="none"
              stroke={low ? 'var(--warn)' : 'var(--line)'}
              strokeWidth={low ? 1.2 : 0.6}
              strokeDasharray={low ? '2 1.2' : undefined}
            />
          </g>
        );
      })}
    </svg>
  );
}
