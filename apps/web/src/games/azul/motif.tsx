import { wallColor } from '@tablekeeper/core';

import type { MotifProps } from '../types';

import { BOX_FILL, TILE_EDGE, TILE_FILL } from './colors';

// The chocolate box: square chocolates in the wall's diagonal color pattern (docs/games/azul.md).
export function Motif({ className }: MotifProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <rect x="4" y="4" width="56" height="56" rx="5" fill={BOX_FILL} />
      {Array.from({ length: 16 }, (_, i) => {
        const row = Math.floor(i / 4);
        const col = i % 4;
        return (
          <rect
            key={i}
            x={8 + col * 12.5}
            y={8 + row * 12.5}
            width="10.5"
            height="10.5"
            rx="1.5"
            fill={TILE_FILL[wallColor(row, col)]}
            stroke={TILE_EDGE}
            strokeOpacity="0.35"
            strokeWidth="0.75"
          />
        );
      })}
    </svg>
  );
}
