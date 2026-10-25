import type { MotifProps } from '../types';

// The test game's 3×3 board with a diagonal covered.
export function Motif({ className }: MotifProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <rect x="4" y="4" width="56" height="56" rx="5" fill="var(--surface)" stroke="var(--line)" />
      {Array.from({ length: 9 }, (_, i) => {
        const row = Math.floor(i / 3);
        const col = i % 3;
        return (
          <rect
            key={i}
            x={9 + col * 16}
            y={9 + row * 16}
            width="14"
            height="14"
            rx="2"
            fill={row === col ? 'var(--accent)' : 'var(--bg)'}
            stroke="var(--line)"
          />
        );
      })}
    </svg>
  );
}
