import type { MotifProps } from '../types';

// A Valentine's chocolate box of pralines: a 3×3 box board, round pralines in the chocolate palette.
const DARK = '#4a2c21';
const MILK = '#8a5a3c';
const WHITE = '#efe2cc';
const CARAMEL = '#c98a3e';
const PINK = '#e58fa6';
const BOX = '#b23a52';

const PRALINES = [DARK, PINK, MILK, CARAMEL, WHITE, DARK, MILK, DARK, PINK];

export function Motif({ className }: MotifProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <rect x="4" y="4" width="56" height="56" rx="6" fill={BOX} />
      <rect x="8" y="8" width="48" height="48" rx="3" fill="#7d2438" />
      {PRALINES.map((color, i) => {
        const cx = 16 + (i % 3) * 16;
        const cy = 16 + Math.floor(i / 3) * 16;
        return (
          <g key={i}>
            <circle cx={cx} cy={cy} r="6.5" fill={color} />
            <circle cx={cx - 2} cy={cy - 2} r="1.6" fill="#ffffff" opacity="0.25" />
          </g>
        );
      })}
    </svg>
  );
}
