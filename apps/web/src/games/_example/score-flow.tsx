'use client';

import { EXAMPLE_LAYOUT, hexKey, squareKey, type CellRef, type HexLayout } from '@tablekeeper/core';
import { useState } from 'react';

import { HexGridEditor } from '@/components/hex-grid-editor';
import { DefaultScoreFlow } from '@/components/score-flow/default-score-flow';
import { SquareGridEditor } from '@/components/square-grid-editor';

import type { ScoreFlowProps } from '../types';

// Two columns of three, plus one: enough to show odd columns sitting half a space lower.
const HEX_LAYOUT: HexLayout = {
  cells: [
    { q: 0, r: 0 },
    { q: 0, r: 1 },
    { q: 0, r: 2 },
    { q: 1, r: 0 },
    { q: 1, r: 1 },
    { q: 2, r: -1 },
    { q: 2, r: 0 },
  ],
};

function describe(ref: CellRef): string {
  switch (ref.kind) {
    case 'square':
      return `square ${squareKey(ref.row, ref.col)}`;
    case 'hex':
      return `hex ${hexKey(ref.q, ref.r)}`;
    case 'slot':
      return `slot ${ref.group} ${ref.index}`;
  }
}

/** Both grid editors side by side, so tests can drive them by pointer and keyboard. */
function EditorCheck() {
  const [last, setLast] = useState<CellRef | null>(null);
  return (
    <section className="flex flex-col gap-4 px-4 py-5">
      <h2 className="text-lg">Editor Check</h2>
      <p className="text-muted" data-testid="last-tap" aria-live="polite">
        {last ? `Last tap: ${describe(last)}` : 'No taps yet.'}
      </p>
      <SquareGridEditor
        layout={EXAMPLE_LAYOUT}
        label="Square Board"
        confidence={{ '1,1': 0.4 }}
        cellLabel={({ row, col }) => `Square row ${row + 1}, column ${col + 1}`}
        renderCell={() => null}
        onTap={setLast}
      />
      <HexGridEditor
        layout={HEX_LAYOUT}
        label="Hex Board"
        confidence={{ '1,0': 0.4 }}
        cellLabel={({ q, r }) => `Hex ${q},${r}`}
        renderCell={() => null}
        onTap={setLast}
      />
    </section>
  );
}

/** The test game uses the default flow; `editor-check` is its extra page for grid tests. */
export function ScoreFlow({ gameId, slug }: ScoreFlowProps) {
  if (slug.length === 1 && slug[0] === 'editor-check') return <EditorCheck />;
  return <DefaultScoreFlow gameId={gameId} slug={slug} />;
}
