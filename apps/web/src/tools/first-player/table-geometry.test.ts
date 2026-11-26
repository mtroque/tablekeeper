import { MAX_PLAYERS } from '@tablekeeper/core';
import { describe, expect, it } from 'vitest';

import { TABLE, toTablePoint, wedgeFill, wedgePath } from './table-geometry';

describe('wedgeFill', () => {
  it.each(Array.from({ length: MAX_PLAYERS - 1 }, (_, i) => i + 2))(
    'never gives neighbors the same fill with %i players',
    (count) => {
      for (let position = 0; position < count; position++) {
        const next = (position + 1) % count;
        expect(wedgeFill(position, count)).not.toBe(wedgeFill(next, count));
      }
    },
  );
});

describe('wedgePath', () => {
  it('fills the whole table for a single wedge', () => {
    expect(wedgePath({ start: 0, end: 2 * Math.PI })).toBe(
      `M0 0H${TABLE.width}V${TABLE.height}H0Z`,
    );
  });

  it('uses the large arc only for wedges wider than half a turn', () => {
    expect(wedgePath({ start: 0, end: Math.PI / 2 })).toMatch(/ 0 0 1 /);
    expect(wedgePath({ start: 0, end: 1.5 * Math.PI })).toMatch(/ 0 1 1 /);
  });
});

describe('toTablePoint', () => {
  it('scales client coordinates into the table area', () => {
    const rect = { left: 10, top: 100, width: 200, height: 240 };
    expect(toTablePoint({ clientX: 110, clientY: 220 }, rect)).toEqual({ x: 50, y: 60 });
  });
});
