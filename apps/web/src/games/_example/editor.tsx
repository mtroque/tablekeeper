'use client';

import {
  EXAMPLE_LAYOUT,
  ExampleStateSchema,
  type ExampleState,
  type SquareCell,
} from '@tablekeeper/core';

import { SquareGridEditor } from '@/components/square-grid-editor';

import type { EditorProps } from '../types';

const EMPTY: ExampleState = { cells: Array.from({ length: 9 }, () => false) };

function asState(state: unknown): ExampleState {
  const parsed = ExampleStateSchema.safeParse(state);
  return parsed.success ? parsed.data : EMPTY;
}

const index = ({ row, col }: SquareCell) => row * 3 + col;

/** Tap a cell to cover or uncover it. */
export function Editor({ state, onChange, confidence }: EditorProps<unknown>) {
  const { cells } = asState(state);
  return (
    <SquareGridEditor
      layout={EXAMPLE_LAYOUT}
      label="Board"
      confidence={confidence}
      cellLabel={(cell) =>
        `Row ${cell.row + 1}, column ${cell.col + 1}: ${cells[index(cell)] ? 'covered' : 'empty'}`
      }
      renderCell={(cell) =>
        cells[index(cell)] ? <span className="size-3/5 rounded-control bg-accent" /> : null
      }
      onTap={(ref) => {
        if (ref.kind !== 'square') return;
        const next = [...cells];
        next[index(ref)] = !next[index(ref)];
        onChange({ cells: next });
      }}
    />
  );
}
