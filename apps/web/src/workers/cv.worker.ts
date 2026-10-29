// Runs packages/cv off the main thread (docs/ARCHITECTURE.md → Computer vision). opencv loads
// once, on the first detection, and stays loaded for the worker's life (the page session).
// Nothing imported here may reach React or the DOM: the guard is cv-worker-imports.test.ts.
import { openCvLoadCount } from '@tablekeeper/cv';
import { installBrowserOpenCv } from '@tablekeeper/cv/browser';
import { z } from 'zod';

import { findDetector } from '@/games/detectors';
import type { CvResponse } from '@/lib/cv-client';

type WorkerScope = {
  onmessage: ((event: MessageEvent<unknown>) => void) | null;
  postMessage(message: CvResponse): void;
};
const scope = self as unknown as WorkerScope;

installBrowserOpenCv();

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
