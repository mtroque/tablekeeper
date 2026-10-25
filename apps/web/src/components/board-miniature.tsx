import {
  hexCenter,
  hexKey,
  squareCells,
  squareKey,
  type CellRef,
  type HexLayout,
  type SquareLayout,
} from '@tablekeeper/core';

import { hexPolygon, hexViewBox } from '@/components/hex-grid-editor';

export type MiniatureLayout =
  { kind: 'square'; layout: SquareLayout } | { kind: 'hex'; layout: HexLayout };

const SIZE = 10;

function refKey(ref: CellRef): string | null {
  switch (ref.kind) {
    case 'square':
      return squareKey(ref.row, ref.col);
    case 'hex':
      return hexKey(ref.q, ref.r);
    case 'slot':
      return null;
  }
}

/**
 * A read-only board with a selected category's cells highlighted. The game supplies each
 * cell's fill; everything else is dimmed while a highlight is shown.
 */
export function BoardMiniature({
  board,
  label,
  cellFill,
  highlights,
}: {
  board: MiniatureLayout;
  label: string;
  cellFill: (key: string) => string;
  highlights?: CellRef[] | undefined;
}) {
  const lit = new Set((highlights ?? []).flatMap((ref) => refKey(ref) ?? []));
  const dim = lit.size > 0;
  const cell = (key: string, shape: React.ReactElement<React.SVGProps<SVGElement>>) => (
    <g
      key={key}
      opacity={dim && !lit.has(key) ? 0.3 : 1}
      data-highlighted={lit.has(key) || undefined}
    >
      {shape}
    </g>
  );

  if (board.kind === 'square') {
    const { rows, cols } = board.layout;
    return (
      <svg
        role="img"
        aria-label={label}
        viewBox={`0 0 ${cols * SIZE} ${rows * SIZE}`}
        className="w-full"
      >
        {squareCells(board.layout).map(({ row, col }) => {
          const key = squareKey(row, col);
          return cell(
            key,
            <rect
              x={col * SIZE + 0.5}
              y={row * SIZE + 0.5}
              width={SIZE - 1}
              height={SIZE - 1}
              rx={1}
              fill={cellFill(key)}
              stroke={lit.has(key) ? 'var(--accent)' : 'var(--line)'}
              strokeWidth={lit.has(key) ? 1 : 0.4}
            />,
          );
        })}
      </svg>
    );
  }

  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={hexViewBox(board.layout.cells, SIZE)}
      className="w-full"
    >
      {board.layout.cells.map((c) => {
        const key = hexKey(c.q, c.r);
        const { x, y } = hexCenter(c, SIZE);
        return cell(
          key,
          <polygon
            points={hexPolygon(x, y, SIZE * 0.92)}
            fill={cellFill(key)}
            stroke={lit.has(key) ? 'var(--accent)' : 'var(--line)'}
            strokeWidth={lit.has(key) ? 1 : 0.4}
          />,
        );
      })}
    </svg>
  );
}
