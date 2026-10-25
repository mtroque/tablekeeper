import { stackCode, type HarmoniesPiece } from '@tablekeeper/core';

/** Token colors (docs/games/harmonies.md → Pieces). */
export const PIECE_COLORS: Record<HarmoniesPiece, string> = {
  W: '#3d7fc1',
  F: '#e8c440',
  M: '#8d8f93',
  T: '#7a4f2e',
  L: '#4f9a45',
  R: '#c4413a',
};

/** The printed space under the tokens. */
export const SPACE_FILL = '#e9dcc3';
export const SPACE_EDGE = '#b9a582';

/**
 * A stack seen from above and a little in front: round tokens, bottom first, each one
 * sitting a little higher, so the height reads at a glance. `size` is the space's radius.
 */
export function StackTokens({
  stack,
  cx,
  cy,
  size,
  showLabel = false,
}: {
  stack: readonly HarmoniesPiece[];
  cx: number;
  cy: number;
  size: number;
  showLabel?: boolean;
}) {
  const radius = size * 0.5;
  const lift = size * 0.17;
  const base = cy + ((stack.length - 1) * lift) / 2;
  return (
    <g aria-hidden="true">
      {stack.map((piece, level) => (
        <circle
          key={level}
          cx={cx}
          cy={base - level * lift}
          r={radius}
          fill={PIECE_COLORS[piece]}
          stroke="#00000040"
          strokeWidth={size * 0.05}
        />
      ))}
      {showLabel && stack.length > 0 && (
        <text
          x={cx}
          y={cy + size * 0.72}
          textAnchor="middle"
          fontSize={size * 0.36}
          fontWeight={700}
          fill="var(--ink)"
          stroke="var(--surface)"
          strokeWidth={size * 0.08}
          paintOrder="stroke"
          className="tabular"
        >
          {stackCode(stack)}
        </text>
      )}
    </g>
  );
}
