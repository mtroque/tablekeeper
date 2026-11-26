// Who goes first (U1): turning players' taps into one wedge each around the center of the table
// area. Angles are in radians in screen coordinates (y grows downwards), so a growing angle turns
// clockwise on screen.
import type { Point, Result } from '../../kit/types';

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 8;
/** Smallest angle between two players' directions, so every wedge stays wide enough to see. */
export const MIN_PLAYER_GAP = Math.PI / 12;

const TURN = 2 * Math.PI;

export type Wedge = {
  /** Index of the player (in tap order) this wedge points at. */
  player: number;
  /** Direction of the player's tap from the center. */
  angle: number;
  /** Boundaries, `start < end`, `end - start <= 2π`; `start` may be below 0. */
  start: number;
  end: number;
};

export type TapRefusal =
  { reason: 'full' } | { reason: 'center' } | { reason: 'too-close'; player: number };

export type TableArea = { center: Point; centerRadius: number };

/** Direction of `point` seen from `center`, in `[0, 2π)`. */
export function angleOf(point: Point, center: Point): number {
  return normalize(Math.atan2(point.y - center.y, point.x - center.x));
}

/** Smallest angle between two directions, in `[0, π]`. */
export function angleBetween(a: number, b: number): number {
  const diff = normalize(a - b);
  return Math.min(diff, TURN - diff);
}

/**
 * One wedge per player, ordered by angle. Each boundary sits halfway between two neighboring
 * players' directions (wrapping around), so each wedge contains its own tap. One player gets the
 * whole circle. Assumes distinct directions, which `addTap` guarantees.
 */
export function wedges(points: readonly Point[], center: Point): Wedge[] {
  const sorted = points
    .map((point, player) => ({ player, angle: angleOf(point, center) }))
    .sort((a, b) => a.angle - b.angle || a.player - b.player);
  if (sorted.length === 1 && sorted[0]) {
    const { player, angle } = sorted[0];
    return [{ player, angle, start: angle - Math.PI, end: angle + Math.PI }];
  }
  return sorted.map(({ player, angle }, index) => {
    const previous = sorted[(index - 1 + sorted.length) % sorted.length] ?? { angle };
    const next = sorted[(index + 1) % sorted.length] ?? { angle };
    const gapBefore = normalize(angle - previous.angle);
    const gapAfter = normalize(next.angle - angle);
    return { player, angle, start: angle - gapBefore / 2, end: angle + gapAfter / 2 };
  });
}

/** Whether the direction `angle` falls inside `wedge` (start inclusive, end exclusive). */
export function wedgeContains(wedge: Wedge, angle: number): boolean {
  const width = wedge.end - wedge.start;
  if (width >= TURN) return true;
  return normalize(angle - wedge.start) < width;
}

/** Adds a player at `tap`, or says why not: the table is full, the tap is in the center, or too close to someone. */
export function addTap(
  points: readonly Point[],
  tap: Point,
  { center, centerRadius }: TableArea,
): Result<Point[], TapRefusal> {
  if (points.length >= MAX_PLAYERS) return { ok: false, error: { reason: 'full' } };
  if (Math.hypot(tap.x - center.x, tap.y - center.y) < centerRadius) {
    return { ok: false, error: { reason: 'center' } };
  }
  const angle = angleOf(tap, center);
  const closest = points.findIndex(
    (point) => angleBetween(angleOf(point, center), angle) < MIN_PLAYER_GAP,
  );
  if (closest !== -1) return { ok: false, error: { reason: 'too-close', player: closest } };
  return { ok: true, value: [...points, tap] };
}

/** Removes the player at `index`; the players after it move up one number. */
export function removePlayer(points: readonly Point[], index: number): Point[] {
  return points.filter((_, i) => i !== index);
}

/**
 * A seat for a player added without a pointer: `radius` from the center, in the middle of the
 * widest gap between players (straight down, towards the phone's bottom edge, for the first).
 */
export function openSeat(points: readonly Point[], center: Point, radius: number): Point {
  const angles = points.map((point) => angleOf(point, center)).sort((a, b) => a - b);
  let direction = Math.PI / 2;
  let widest = -1;
  angles.forEach((angle, index) => {
    const next = angles[(index + 1) % angles.length] ?? angle;
    const gap = angles.length === 1 ? TURN : normalize(next - angle);
    if (gap > widest) {
      widest = gap;
      direction = angle + gap / 2;
    }
  });
  return {
    x: center.x + radius * Math.cos(direction),
    y: center.y + radius * Math.sin(direction),
  };
}

function normalize(angle: number): number {
  const turned = angle % TURN;
  return turned < 0 ? turned + TURN : turned;
}
