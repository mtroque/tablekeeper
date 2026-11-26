import type { Point, Wedge } from '@tablekeeper/core';

/** The table area's own coordinates (SVG viewBox); the element keeps this aspect ratio. */
export const TABLE = { width: 100, height: 120 } as const;
export const TABLE_CENTER: Point = { x: TABLE.width / 2, y: TABLE.height / 2 };
/** Taps closer than this to the center belong to the spin button, not a seat. */
export const CENTER_RADIUS = 16;
/** Where a player added from the keyboard is seated. */
export const SEAT_RADIUS = 40;
/** Past every corner of the table area, so wedges reach the edges. */
const WEDGE_RADIUS = Math.hypot(TABLE.width, TABLE.height);

/** SVG path for a wedge from the table center out past the edges. */
export function wedgePath(wedge: Pick<Wedge, 'start' | 'end'>): string {
  const { x: cx, y: cy } = TABLE_CENTER;
  const width = wedge.end - wedge.start;
  if (width >= 2 * Math.PI - 1e-9) {
    return `M0 0H${TABLE.width}V${TABLE.height}H0Z`;
  }
  const from = polar(wedge.start);
  const to = polar(wedge.end);
  const largeArc = width > Math.PI ? 1 : 0;
  return `M${cx} ${cy}L${from}A${WEDGE_RADIUS} ${WEDGE_RADIUS} 0 ${largeArc} 1 ${to}Z`;
}

function polar(angle: number): string {
  const x = TABLE_CENTER.x + WEDGE_RADIUS * Math.cos(angle);
  const y = TABLE_CENTER.y + WEDGE_RADIUS * Math.sin(angle);
  return `${round(x)} ${round(y)}`;
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/** Wedge fills from the design tokens; neighbors never share one, including across the wrap. */
const FILLS = ['var(--accent-soft)', 'var(--warn-soft)', 'var(--surface)', 'var(--line)'] as const;

export function wedgeFill(position: number, count: number): string {
  const wrapsOntoFirst = count > 1 && position === count - 1 && position % FILLS.length === 0;
  const index = wrapsOntoFirst ? 2 : position % FILLS.length;
  return FILLS[index] ?? FILLS[0];
}

/** A tap at client coordinates, in table coordinates. */
export function toTablePoint(
  client: { clientX: number; clientY: number },
  rect: { left: number; top: number; width: number; height: number },
): Point {
  return {
    x: ((client.clientX - rect.left) / rect.width) * TABLE.width,
    y: ((client.clientY - rect.top) / rect.height) * TABLE.height,
  };
}
