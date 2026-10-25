// Runs packages/cv off the main thread (docs/ARCHITECTURE.md → Computer vision). opencv loads
// once, on the first detection, and stays loaded for the worker's life (the page session).
import { isGameId, type Detector } from '@tablekeeper/core';
import { openCvLoadCount } from '@tablekeeper/cv';
import { installBrowserOpenCv } from '@tablekeeper/cv/browser';
import { z } from 'zod';

import { GAME_UI } from '@/games/registry';
import type { CvResponse } from '@/lib/cv-client';

type WorkerScope = {
  onmessage: ((event: MessageEvent<unknown>) => void) | null;
  postMessage(message: CvResponse): void;
};
const scope = self as unknown as WorkerScope;

installBrowserOpenCv();

const exampleEnabled =
  process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_ENABLE_EXAMPLE_GAME === 'true';

/** Detectors that aren't a registered game's (the S1 example game, outside production). */
const EXTRA_DETECTORS: Record<string, () => Promise<Detector<unknown>>> = exampleEnabled
  ? {
      _example: () => import('@tablekeeper/cv/games/_example').then((m) => m.detector),
    }
  : {};

const PointSchema = z.object({ x: z.number(), y: z.number() });
const RequestSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('detect'),
    id: z.number().int(),
    detectorId: z.string(),
    image: z.object({
      data: z.instanceof(Uint8ClampedArray),
      width: z.number().int().positive(),
      height: z.number().int().positive(),
    }),
    corners: z.tuple([PointSchema, PointSchema, PointSchema, PointSchema]).optional(),
  }),
  z.object({ type: z.literal('stats'), id: z.number().int() }),
]);

function findDetector(id: string): (() => Promise<Detector<unknown>>) | undefined {
  if (isGameId(id)) return GAME_UI[id].detector;
  return EXTRA_DETECTORS[id];
}

async function detect(
  request: Extract<z.infer<typeof RequestSchema>, { type: 'detect' }>,
): Promise<CvResponse> {
  const { id } = request;
  const load = findDetector(request.detectorId);
  if (!load) return { type: 'result', id, result: { ok: false, error: 'unavailable' } };
  try {
    const detector = await load();
    const draft = await detector.detect(request.image, {
      ...(request.corners ? { corners: request.corners } : {}),
      onProgress: (stage) => {
        scope.postMessage({ type: 'progress', id, stage });
      },
    });
    return { type: 'result', id, result: { ok: true, value: draft } };
  } catch (error) {
    console.error('Board detection failed', error);
    return { type: 'result', id, result: { ok: false, error: 'failed' } };
  }
}

scope.onmessage = (event) => {
  const parsed = RequestSchema.safeParse(event.data);
  if (!parsed.success) return;
  const request = parsed.data;
  if (request.type === 'stats') {
    scope.postMessage({ type: 'stats', id: request.id, opencvLoads: openCvLoadCount() });
    return;
  }
  void detect(request).then((response) => {
    scope.postMessage(response);
  });
};
