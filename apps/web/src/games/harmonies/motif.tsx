import { hexPoints } from '../hex';
import type { MotifProps } from '../types';

import { PIECE_COLORS, SPACE_EDGE, SPACE_FILL } from './pieces';

// Round tokens sitting on a hex grid, in the token colors (docs/games/harmonies.md → Pieces).
const { W: WATER, F: FIELD, M: MOUNTAIN, T: TRUNK, L: LEAVES, R: ROOF } = PIECE_COLORS;

const R = 10;
const W = Math.sqrt(3) * R;
// Hex centers and the tokens stacked on each, bottom to top.
const CELLS: Array<{ x: number; y: number; stack: string[] }> = [
  { x: 32 - W / 2, y: 17, stack: [WATER] },
  { x: 32 + W / 2, y: 17, stack: [TRUNK, LEAVES] },
  { x: 32 - W, y: 32, stack: [FIELD] },
  { x: 32, y: 32, stack: [MOUNTAIN, MOUNTAIN] },
  { x: 32 + W, y: 32, stack: [TRUNK, ROOF] },
  { x: 32 - W / 2, y: 47, stack: [LEAVES] },
  { x: 32 + W / 2, y: 47, stack: [WATER] },
];

export function Motif({ className }: MotifProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      {CELLS.map(({ x, y, stack }, i) => (
        <g key={i}>
          <polygon
            points={hexPoints(x, y, R - 0.6)}
            fill={SPACE_FILL}
            stroke={SPACE_EDGE}
            strokeWidth="0.8"
          />
          {stack.map((color, level) => (
            <circle
              key={level}
              cx={x}
              cy={y + 1.5 - level * 2.5}
              r="5.2"
              fill={color}
              stroke="#00000033"
              strokeWidth="0.6"
            />
          ))}
        </g>
      ))}
    </svg>
  );
}
