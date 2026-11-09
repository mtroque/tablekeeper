import type { Draft, ImageInput, Quad } from '@tablekeeper/core';
import { describe, expect, it, vi } from 'vitest';

import type { CvError, DetectBoardOptions } from '@/lib/cv-client';
import type { FlowState } from '@/lib/session-store/flow-state';

import { rereadFlow } from './reread';
import { manualFlow, requireGame } from './use-flow';

const game = requireGame('_example');
const PIXELS: ImageInput = { data: new Uint8ClampedArray(16), width: 2, height: 2 };
const CORNERS: Quad = [
  { x: 1, y: 1 },
  { x: 9, y: 1 },
  { x: 9, y: 9 },
  { x: 1, y: 9 },
];
const READ: Draft<unknown> = {
  state: { cells: [true, true, false, false, false, false, false, false, true] },
  confidence: { '0,0': 0.9, '0,1': 0.4 },
  corners: CORNERS,
  warnings: ['Part of the board is in shadow.'],
};

/** An _example flow on review: a photo, corners, and a first reading the player has edited. */
const FLOW: FlowState = {
  ...manualFlow(game),
  source: 'photo',
  state: { cells: Array<boolean>(9).fill(true) },
  draft: { state: { cells: Array<boolean>(9).fill(false) }, confidence: { '0,0': 0.2 } },
  photo: { src: 'data:image/jpeg;base64,', width: 10, height: 10 },
  corners: CORNERS,
  warnings: ['Old warning.'],
};

function deps(result: { ok: true; value: Draft<unknown> } | { ok: false; error: CvError }) {
  return {
    pixels: vi.fn(() => Promise.resolve(PIXELS)),
    detect: vi.fn((_id: string, _image: ImageInput, _corners?: Quad, _opts?: DetectBoardOptions) =>
      Promise.resolve(result),
    ),
  };
}

describe('rereadFlow (ReviewStep reread)', () => {
  it('reads the photo at the flow corners with the hints and stores the new reading', async () => {
    const d = deps({ ok: true, value: READ });
    const next = await rereadFlow(game.id, FLOW, { board: 'green' }, d);
    expect(d.pixels).toHaveBeenCalledWith(FLOW.photo);
    expect(d.detect).toHaveBeenCalledWith('_example', PIXELS, CORNERS, {
      hints: { board: 'green' },
    });
    expect(next).toEqual({
      ...FLOW,
      state: READ.state,
      draft: { state: READ.state, confidence: READ.confidence },
      warnings: READ.warnings,
    });
  });

  it.each(['unavailable', 'timeout', 'failed'] as const)('is null on %s', async (error) => {
    await expect(
      rereadFlow(game.id, FLOW, { board: 'green' }, deps({ ok: false, error })),
    ).resolves.toBeNull();
  });

  it('is null when the photo cannot be decoded', async () => {
    const d = deps({ ok: true, value: READ });
    d.pixels.mockRejectedValueOnce(new Error('Image failed to load'));
    await expect(rereadFlow(game.id, FLOW, {}, d)).resolves.toBeNull();
    expect(d.detect).not.toHaveBeenCalled();
  });

  it('is null without a photo or corners', async () => {
    const d = deps({ ok: true, value: READ });
    await expect(rereadFlow(game.id, manualFlow(game), {}, d)).resolves.toBeNull();
    await expect(rereadFlow(game.id, { ...FLOW, corners: null }, {}, d)).resolves.toBeNull();
    expect(d.detect).not.toHaveBeenCalled();
  });
});
