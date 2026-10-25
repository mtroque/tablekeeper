'use client';

import {
  isSquareCell,
  squareKey,
  squareRef,
  type CellRef,
  type SquareCell,
  type SquareLayout,
} from '@tablekeeper/core';
import { useRef, useState } from 'react';

import { confidenceOutlineClass } from '@/components/confidence-outline';
import { cn } from '@/lib/utils';

const MOVES: Record<string, [number, number]> = {
  ArrowUp: [-1, 0],
  ArrowDown: [1, 0],
  ArrowLeft: [0, -1],
  ArrowRight: [0, 1],
};

/**
 * An N×M board of buttons. The game draws each cell and names it; taps come back as
 * `CellRef`s. One cell is in the tab order; arrow keys move between cells.
 */
export function SquareGridEditor({
  layout,
  label,
  renderCell,
  cellLabel,
  onTap,
  confidence,
  className,
}: {
  layout: SquareLayout;
  label: string;
  renderCell: (cell: SquareCell) => React.ReactNode;
  /** Spoken name with the cell's value, e.g. "Row 3, column 5: covered". */
  cellLabel: (cell: SquareCell) => string;
  onTap: (ref: CellRef) => void;
  confidence?: Record<string, number> | undefined;
  className?: string;
}) {
  const [focus, setFocus] = useState<SquareCell>({ row: 0, col: 0 });
  const refs = useRef(new Map<string, HTMLButtonElement>());

  const moveFocus = (from: SquareCell, [dr, dc]: [number, number]) => {
    let { row, col } = from;
    // Skip over positions that aren't spaces.
    do {
      row += dr;
      col += dc;
    } while (
      row >= 0 &&
      col >= 0 &&
      row < layout.rows &&
      col < layout.cols &&
      !isSquareCell(layout, row, col)
    );
    if (!isSquareCell(layout, row, col)) return;
    setFocus({ row, col });
    refs.current.get(squareKey(row, col))?.focus();
  };

  return (
    <div
      role="group"
      aria-label={label}
      className={cn('grid w-full gap-1', className)}
      style={{ gridTemplateColumns: `repeat(${layout.cols}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: layout.rows * layout.cols }, (_, i) => {
        const cell = { row: Math.floor(i / layout.cols), col: i % layout.cols };
        const key = squareKey(cell.row, cell.col);
        if (!isSquareCell(layout, cell.row, cell.col)) return <div key={key} aria-hidden />;
        const focused = focus.row === cell.row && focus.col === cell.col;
        return (
          <button
            key={key}
            ref={(el) => {
              if (el) refs.current.set(key, el);
              else refs.current.delete(key);
            }}
            type="button"
            tabIndex={focused ? 0 : -1}
            aria-label={cellLabel(cell)}
            data-cell={key}
            data-low-confidence={confidenceOutlineClass(confidence?.[key]) ? true : undefined}
            className={cn(
              'relative flex aspect-square min-h-11 items-center justify-center overflow-hidden rounded-control border border-line bg-surface',
              confidenceOutlineClass(confidence?.[key]),
            )}
            onFocus={() => {
              setFocus(cell);
            }}
            onClick={() => {
              onTap(squareRef(cell.row, cell.col));
            }}
            onKeyDown={(event) => {
              const move = MOVES[event.key];
              if (!move) return;
              event.preventDefault();
              moveFocus(cell, move);
            }}
          >
            {renderCell(cell)}
          </button>
        );
      })}
    </div>
  );
}
