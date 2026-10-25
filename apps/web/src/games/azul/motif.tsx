import type { MotifProps } from '../types';

// The chocolate box: square chocolates in the wall's diagonal color pattern (docs/games/azul.md).
const COLORS = ['#7cc4cf', '#b88a5e', '#f1e6d2', '#3b2219', '#b8203f']; // teal, brown, white, black, red

export function Motif({ className }: MotifProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <rect x="4" y="4" width="56" height="56" rx="5" fill="#5a3a2a" />
      {Array.from({ length: 16 }, (_, i) => {
        const row = Math.floor(i / 4);
        const col = i % 4;
        const color = COLORS[(col - row + 5) % 5];
        return (
          <rect
            key={i}
            x={8 + col * 12.5}
            y={8 + row * 12.5}
            width="10.5"
            height="10.5"
            rx="1.5"
            fill={color}
            stroke="#2b1a12"
            strokeOpacity="0.35"
            strokeWidth="0.75"
          />
        );
      })}
    </svg>
  );
}
