import { hexPoints } from '../hex';
import type { MotifProps } from '../types';

// Landscape hexes: forest, grain, village, track and stream (docs/games/dorfromantik.md).
const FOREST = '#3f7a3a';
const GRAIN = '#e3c25a';
const VILLAGE = '#c75b45';
const MEADOW = '#9cc46b';
const STREAM = '#4f93c9';
const TRACK = '#8a7a66';

const R = 11;
const W = Math.sqrt(3) * R;

export function Motif({ className }: MotifProps) {
  const tiles = [
    { x: 32 - W / 2, y: 15.5, fill: FOREST },
    { x: 32 + W / 2, y: 15.5, fill: GRAIN },
    { x: 32 - W, y: 32, fill: MEADOW },
    { x: 32, y: 32, fill: VILLAGE },
    { x: 32 + W, y: 32, fill: FOREST },
    { x: 32 - W / 2, y: 48.5, fill: GRAIN },
    { x: 32 + W / 2, y: 48.5, fill: MEADOW },
  ];
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      {tiles.map(({ x, y, fill }, i) => (
        <polygon
          key={i}
          points={hexPoints(x, y, R - 0.5)}
          fill={fill}
          stroke="#f3ead8"
          strokeWidth="1"
        />
      ))}
      {/* A stream and a track crossing the tiles. */}
      <path
        d={`M ${32 - W - 8} 34 Q 26 40 ${32 + W / 2} 56`}
        fill="none"
        stroke={STREAM}
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <path
        d={`M ${32 - W / 2} 6 L 32 32 L ${32 + W + 8} 30`}
        fill="none"
        stroke={TRACK}
        strokeWidth="1.8"
        strokeDasharray="3 2"
      />
      {/* Village roofs. */}
      <path d="M 27 33 l 3 -4 l 3 4 z M 32 36 l 3 -4 l 3 4 z" fill="#f3ead8" />
    </svg>
  );
}
