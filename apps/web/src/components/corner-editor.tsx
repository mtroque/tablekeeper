'use client';

import type { Point, Quad } from '@tablekeeper/core';
import { useRef, useState } from 'react';

const CORNER_NAMES = ['Top left', 'Top right', 'Bottom right', 'Bottom left'] as const;
const MAGNIFIER = 96;
const ZOOM = 2.5;
const KEY_STEP = 0.005;

type Size = { width: number; height: number };

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * Four draggable corner handles over a photo, with a magnifier while dragging and arrow-key
 * nudging. Corners are in the photo's pixel coordinates.
 */
export function CornerEditor({
  src,
  size,
  corners,
  onChange,
}: {
  src: string;
  size: Size;
  corners: Quad;
  onChange: (corners: Quad) => void;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<number | null>(null);

  const toFraction = (p: Point) => ({ x: p.x / size.width, y: p.y / size.height });
  const move = (index: number, fraction: Point) => {
    const next = [...corners] as Quad;
    next[index] = {
      x: clamp01(fraction.x) * size.width,
      y: clamp01(fraction.y) * size.height,
    };
    onChange(next);
  };
  const fromPointer = (event: React.PointerEvent): Point | null => {
    const rect = frameRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return {
      x: (event.clientX - rect.left) / rect.width,
      y: (event.clientY - rect.top) / rect.height,
    };
  };

  const points = corners.map(toFraction);
  const polygon = points.map((p) => `${p.x * 100},${p.y * 100}`).join(' ');
  const active = dragging === null ? null : points[dragging];

  return (
    <div
      ref={frameRef}
      className="relative w-full touch-none select-none"
      style={{ aspectRatio: `${size.width} / ${size.height}` }}
    >
      {/* A user photo as an object URL: next/image can't optimize it. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt="Your board photo"
        className="absolute inset-0 size-full"
        draggable={false}
      />
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0 size-full"
        aria-hidden
      >
        <polygon
          points={polygon}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={0.6}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {points.map((p, index) => (
        <button
          key={CORNER_NAMES[index]}
          type="button"
          aria-label={`${CORNER_NAMES[index]} corner. Use the arrow keys to move it.`}
          className="absolute size-11 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            setDragging(index);
          }}
          onPointerMove={(event) => {
            if (dragging !== index) return;
            const point = fromPointer(event);
            if (point) move(index, point);
          }}
          onPointerUp={() => {
            setDragging(null);
          }}
          onPointerCancel={() => {
            setDragging(null);
          }}
          onKeyDown={(event) => {
            const delta: Record<string, Point> = {
              ArrowUp: { x: 0, y: -KEY_STEP },
              ArrowDown: { x: 0, y: KEY_STEP },
              ArrowLeft: { x: -KEY_STEP, y: 0 },
              ArrowRight: { x: KEY_STEP, y: 0 },
            };
            const d = delta[event.key];
            if (!d) return;
            event.preventDefault();
            const step = event.shiftKey ? 4 : 1;
            move(index, { x: p.x + d.x * step, y: p.y + d.y * step });
          }}
        >
          <span
            className={
              dragging === index
                ? 'absolute inset-2.5 rounded-full border-2 border-accent bg-surface/60 shadow-md'
                : 'absolute inset-3 rounded-full border-2 border-accent bg-surface/60'
            }
          />
        </button>
      ))}
      {active && (
        <div
          className="pointer-events-none absolute overflow-hidden rounded-full border-2 border-accent shadow-md"
          style={{
            width: MAGNIFIER,
            height: MAGNIFIER,
            // Above the finger, so it isn't covered.
            left: `calc(${active.x * 100}% - ${MAGNIFIER / 2}px)`,
            top: `calc(${active.y * 100}% - ${MAGNIFIER + 36}px)`,
            backgroundImage: `url(${src})`,
            backgroundRepeat: 'no-repeat',
            backgroundSize: `${ZOOM * 100}% auto`,
            backgroundPosition: `${active.x * 100}% ${active.y * 100}%`,
          }}
          aria-hidden
        />
      )}
    </div>
  );
}
