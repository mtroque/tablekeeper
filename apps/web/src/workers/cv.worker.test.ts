import type { DetectOptions, Draft, Quad } from '@tablekeeper/core';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import type { CvRequest, CvResponse } from '@/lib/cv-client';

// The worker runs on `self`; this drives it with a fake scope and a fake detector.

const P = { x: 0, y: 0 };
const DRAFT: Draft<unknown> = { state: {}, confidence: {}, corners: [P, P, P, P], warnings: [] };
const detect = vi.fn((_image: unknown, _opts?: DetectOptions) => Promise.resolve(DRAFT));

vi.mock('@tablekeeper/cv', () => ({ openCvLoadCount: () => 0 }));
vi.mock('@tablekeeper/cv/browser', () => ({ installBrowserOpenCv: () => undefined }));
vi.mock('@/games/detectors', () => ({
  findDetector: (id: string) =>
    id === 'patchwork' ? () => Promise.resolve({ detect }) : undefined,
}));

const scope = {
  onmessage: null as ((event: { data: unknown }) => void) | null,
  postMessage: vi.fn<(message: CvResponse) => void>(),
};

beforeAll(async () => {
  vi.stubGlobal('self', scope);
  await import('./cv.worker');
});

async function send(request: CvRequest): Promise<CvResponse> {
  scope.postMessage.mockClear();
  scope.onmessage?.({ data: request });
  await vi.waitFor(() => {
    expect(scope.postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'result' }));
  });
  return scope.postMessage.mock.calls.at(-1)![0];
}

const IMAGE = { data: new Uint8ClampedArray(16), width: 2, height: 2 };

describe('cv worker', () => {
  it('passes corners and hints to the detector', async () => {
    const corners: Quad = [P, P, P, P];
    const response = await send({
      type: 'detect',
      id: 1,
      detectorId: 'patchwork',
      image: IMAGE,
      corners,
      hints: { board: 'green' },
    });
    expect(response).toEqual({ type: 'result', id: 1, result: { ok: true, value: DRAFT } });
    expect(detect.mock.calls.at(-1)![1]).toMatchObject({ corners, hints: { board: 'green' } });
  });

  it('leaves hints out when none are sent', async () => {
    await send({ type: 'detect', id: 2, detectorId: 'patchwork', image: IMAGE });
    expect(detect.mock.calls.at(-1)![1]).not.toHaveProperty('hints');
  });

  it('is unavailable without a detector', async () => {
    const response = await send({ type: 'detect', id: 3, detectorId: 'azul', image: IMAGE });
    expect(response).toEqual({
      type: 'result',
      id: 3,
      result: { ok: false, error: 'unavailable' },
    });
  });
});
