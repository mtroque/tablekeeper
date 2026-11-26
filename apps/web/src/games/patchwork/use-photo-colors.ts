'use client';

import { PatchworkStateSchema, type PatchworkBoard, type Quad } from '@tablekeeper/core';
import type { MeasuredColors, SpaceColor } from '@tablekeeper/cv/games/patchwork';
import { useMemo, useState } from 'react';

import { photoPixels } from '@/components/score-flow/photo';
import { useFlow } from '@/components/score-flow/use-flow';
import { useOnMount } from '@/lib/hooks';

/** The `performance` entry timing the color reading. */
export const PIECE_COLORS_MEASURE = 'patchwork:piece-colors';

type PieceColors = (measured: MeasuredColors, board: PatchworkBoard) => SpaceColor[];

/**
 * The piece color of each space the photo read as covered, for drawing the box board (null for
 * the others). Null for a board without a photo, while the photo is still being read, or when
 * reading it fails. Measured once per review on the main thread (D-064), corrected for `board`
 * on every render; kept here, never in the state.
 */
export function usePhotoColors(board: PatchworkBoard): Array<SpaceColor | null> | null {
  const { flow } = useFlow('patchwork');
  const [read, setRead] = useState<{ measured: MeasuredColors; colorsFor: PieceColors } | null>(
    null,
  );
  useOnMount(async (signal) => {
    if (flow?.source !== 'photo' || !flow.photo || !flow.corners) return;
    const { photo, corners } = flow;
    try {
      const [pixels, cv] = await Promise.all([
        photoPixels(photo),
        import('@tablekeeper/cv/games/patchwork'),
      ]);
      if (signal.aborted) return;
      const start = performance.now();
      const measured = cv.measureSpaceColors(pixels, corners as Quad);
      cv.pieceColors(measured, board);
      // Recorded for the P4 timing check (under 100ms on a 1200px photo).
      performance.measure(PIECE_COLORS_MEASURE, { start, end: performance.now() });
      setRead({ measured, colorsFor: cv.pieceColors });
    } catch (error) {
      // The board is still right without colors; it is drawn plain.
      console.error('Reading the piece colors failed', error);
    }
  });

  const draftState = flow?.draft?.state;
  const readCovered = useMemo(() => {
    const draft = PatchworkStateSchema.safeParse(draftState);
    return draft.success ? draft.data.grid : null;
  }, [draftState]);
  return useMemo(() => {
    if (!read || !readCovered) return null;
    return read.colorsFor(read.measured, board).map((color, i) => (readCovered[i] ? color : null));
  }, [read, readCovered, board]);
}
