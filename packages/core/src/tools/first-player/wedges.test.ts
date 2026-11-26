import { describe, expect, it } from 'vitest';

import type { Point } from '../../kit/types';

import {
  addTap,
  angleOf,
  MAX_PLAYERS,
  openSeat,
  removePlayer,
  wedgeContains,
  wedges,
} from './wedges';

const CENTER: Point = { x: 50, y: 60 };
const AREA = { center: CENTER, centerRadius: 16 };

/** A point `radius` from the center in direction `degrees` (0 is right, 90 is down). */
function at(degrees: number, radius = 40): Point {
  const angle = (degrees * Math.PI) / 180;
  return { x: CENTER.x + radius * Math.cos(angle), y: CENTER.y + radius * Math.sin(angle) };
}

function expectEachWedgeHoldsItsTap(points: Point[]) {
  const result = wedges(points, CENTER);
  expect(result).toHaveLength(points.length);
  for (const wedge of result) {
    const tap = points[wedge.player];
    if (!tap) throw new Error('wedge for a missing player');
    expect(wedgeContains(wedge, angleOf(tap, CENTER))).toBe(true);
    // No other player's tap falls in this wedge.
    points.forEach((other, player) => {
      if (player !== wedge.player) expect(wedgeContains(wedge, angleOf(other, CENTER))).toBe(false);
    });
  }
  // The wedges cover the whole circle once.
  const total = result.reduce((sum, wedge) => sum + (wedge.end - wedge.start), 0);
  expect(total).toBeCloseTo(2 * Math.PI, 9);
  return result;
}

describe('wedges', () => {
  it('gives three taps on different sides three wedges, each containing its tap', () => {
    // Bottom, top-left, right: tap order differs from angle order.
    const points = [at(90), at(220), at(350)];
    const result = expectEachWedgeHoldsItsTap(points);
    expect(result.map((wedge) => wedge.player)).toEqual([0, 1, 2]);
    expect(result.map((wedge) => wedge.angle)).toEqual(
      [...result.map((wedge) => wedge.angle)].sort((a, b) => a - b),
    );
  });

  it('orders wedges by angle, not by tap order', () => {
    const result = expectEachWedgeHoldsItsTap([at(300), at(10), at(150)]);
    expect(result.map((wedge) => wedge.player)).toEqual([1, 2, 0]);
  });

  it('puts each boundary halfway between neighbors', () => {
    const result = wedges([at(0), at(90), at(180), at(270)], CENTER);
    for (const wedge of result) {
      expect(wedge.end - wedge.start).toBeCloseTo(Math.PI / 2, 9);
      expect(wedge.angle - wedge.start).toBeCloseTo(Math.PI / 4, 9);
    }
  });

  it('keeps taps at nearly the same angle in their own thin wedges', () => {
    const result = expectEachWedgeHoldsItsTap([at(45), at(45.05, 20), at(200)]);
    const thin = result.filter((wedge) => wedge.player !== 2);
    for (const wedge of thin) expect(wedge.end - wedge.start).toBeGreaterThan(0);
  });

  it('splits the empty side halfway when everyone taps along one side', () => {
    // All along the bottom edge.
    const result = expectEachWedgeHoldsItsTap([at(60), at(90), at(120)]);
    const left = result.find((wedge) => wedge.player === 2);
    const right = result.find((wedge) => wedge.player === 0);
    // The 300 degree gap from 120 round to 60 is split at 270 (straight up).
    expect(left?.end).toBeCloseTo((270 * Math.PI) / 180, 9);
    expect(right?.start).toBeCloseTo((-90 * Math.PI) / 180, 9);
  });

  it('gives one player the whole circle', () => {
    const [only] = wedges([at(30)], CENTER);
    expect(only && only.end - only.start).toBeCloseTo(2 * Math.PI, 9);
    expect(only && wedgeContains(only, Math.PI)).toBe(true);
  });

  it('works for the most players', () => {
    expectEachWedgeHoldsItsTap(Array.from({ length: MAX_PLAYERS }, (_, i) => at(i * 45 + 7)));
  });
});

describe('addTap', () => {
  it('adds a player at the tap', () => {
    const result = addTap([at(0)], at(180), AREA);
    expect(result).toEqual({ ok: true, value: [at(0), at(180)] });
  });

  it('refuses a tap in the center', () => {
    expect(addTap([], at(0, 10), AREA)).toEqual({ ok: false, error: { reason: 'center' } });
  });

  it('refuses a tap within 15 degrees of another player', () => {
    expect(addTap([at(0), at(90)], at(100, 20), AREA)).toEqual({
      ok: false,
      error: { reason: 'too-close', player: 1 },
    });
    // Across the wrap from 359 to 5 degrees.
    expect(addTap([at(359)], at(5), AREA)).toEqual({
      ok: false,
      error: { reason: 'too-close', player: 0 },
    });
    expect(addTap([at(0)], at(16), AREA).ok).toBe(true);
  });

  it('refuses a ninth player', () => {
    const full = Array.from({ length: MAX_PLAYERS }, (_, i) => at(i * 45));
    expect(addTap(full, at(20), AREA)).toEqual({ ok: false, error: { reason: 'full' } });
  });
});

describe('removePlayer', () => {
  it('moves later players up one number', () => {
    expect(removePlayer([at(0), at(90), at(180)], 1)).toEqual([at(0), at(180)]);
  });
});

describe('openSeat', () => {
  it('seats the first player towards the bottom edge', () => {
    const seat = openSeat([], CENTER, 40);
    expect(seat.x).toBeCloseTo(CENTER.x, 9);
    expect(seat.y).toBeCloseTo(CENTER.y + 40, 9);
  });

  it('seats the next player opposite a lone player', () => {
    expect(angleOf(openSeat([at(90)], CENTER, 40), CENTER)).toBeCloseTo((270 * Math.PI) / 180, 9);
  });

  it('seats a player in the middle of the widest gap', () => {
    const seat = openSeat([at(0), at(90), at(180)], CENTER, 40);
    expect(angleOf(seat, CENTER)).toBeCloseTo((270 * Math.PI) / 180, 9);
    expect(addTap([at(0), at(90), at(180)], seat, AREA).ok).toBe(true);
  });
});
