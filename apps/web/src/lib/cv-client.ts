import type { DetectStage, Draft, GameId, ImageInput, Quad, Result } from '@tablekeeper/core';

export type CvError = 'unavailable' | 'timeout' | 'failed';

export type DetectBoardOptions = {
  onProgress?: (stage: DetectStage) => void;
  signal?: AbortSignal;
};

// ---------- Worker protocol (shared with workers/cv.worker.ts) ----------

export type CvRequest =
  | { type: 'detect'; id: number; detectorId: string; image: ImageInput; corners?: Quad }
  | { type: 'stats'; id: number };

export type CvResponse =
  | { type: 'progress'; id: number; stage: DetectStage }
  | { type: 'result'; id: number; result: Result<Draft<unknown>, CvError> }
  | { type: 'stats'; id: number; opencvLoads: number };

/** The part of `Worker` the client uses, so tests can pass a fake. */
export type CvWorker = {
  postMessage(message: CvRequest, transfer: Transferable[]): void;
  terminate(): void;
  onmessage: ((event: MessageEvent<CvResponse>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
};

export type CvStats = { workersCreated: number; opencvLoads: number };

/** No progress for this long ends a detection (each progress event restarts the clock). */
export const DETECT_TIMEOUT_MS = 20_000;

type Pending = {
  resolve: (value: CvResponse) => void;
  onProgress?: (stage: DetectStage) => void;
  restartTimer?: () => void;
};

/**
 * Promise API over one CV worker, created on first use and kept for the page session so opencv
 * loads once. A timeout terminates the worker; the next call starts a new one.
 */
export function createCvClient(
  createWorker: () => CvWorker | undefined,
  timeoutMs = DETECT_TIMEOUT_MS,
) {
  let worker: CvWorker | undefined;
  let workersCreated = 0;
  let nextId = 1;
  const pending = new Map<number, Pending>();

  function failAll(): void {
    for (const [id, entry] of pending) {
      entry.resolve({ type: 'result', id, result: { ok: false, error: 'failed' } });
    }
    pending.clear();
  }

  function getWorker(): CvWorker | undefined {
    if (worker) return worker;
    worker = createWorker();
    if (!worker) return undefined;
    workersCreated += 1;
    worker.onmessage = ({ data }) => {
      const entry = pending.get(data.id);
      if (!entry) return;
      if (data.type === 'progress') {
        entry.restartTimer?.();
        entry.onProgress?.(data.stage);
        return;
      }
      pending.delete(data.id);
      entry.resolve(data);
    };
    worker.onerror = () => {
      // A crashed worker can't be trusted with the next call either.
      worker?.terminate();
      worker = undefined;
      failAll();
    };
    return worker;
  }

  async function detectWith(
    detectorId: string,
    image: ImageInput,
    corners?: Quad,
    options: DetectBoardOptions = {},
  ): Promise<Result<Draft<unknown>, CvError>> {
    const target = getWorker();
    if (!target) return { ok: false, error: 'unavailable' };
    if (options.signal?.aborted) return { ok: false, error: 'failed' };
    const id = nextId++;
    // Copy so the caller keeps its pixels; the copy's buffer is transferred, not cloned.
    const data = new Uint8ClampedArray(image.data);
    const message: CvRequest = {
      type: 'detect',
      id,
      detectorId,
      image: { data, width: image.width, height: image.height },
      ...(corners ? { corners } : {}),
    };

    const response = await new Promise<CvResponse | 'timeout' | 'aborted'>((resolve) => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const finish = (value: CvResponse | 'timeout' | 'aborted') => {
        clearTimeout(timer);
        options.signal?.removeEventListener('abort', onAbort);
        pending.delete(id);
        resolve(value);
      };
      const restartTimer = () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          finish('timeout');
        }, timeoutMs);
      };
      const onAbort = () => {
        finish('aborted');
      };
      options.signal?.addEventListener('abort', onAbort);
      pending.set(id, {
        resolve: finish,
        restartTimer,
        ...(options.onProgress ? { onProgress: options.onProgress } : {}),
      });
      restartTimer();
      target.postMessage(message, [data.buffer]);
    });

    if (response === 'timeout') {
      if (worker === target) {
        target.terminate();
        worker = undefined;
        failAll();
      }
      return { ok: false, error: 'timeout' };
    }
    if (response === 'aborted') return { ok: false, error: 'failed' };
    return response.type === 'result' ? response.result : { ok: false, error: 'failed' };
  }

  async function stats(): Promise<CvStats> {
    const target = worker;
    if (!target) return { workersCreated, opencvLoads: 0 };
    const id = nextId++;
    const response = await new Promise<CvResponse>((resolve) => {
      pending.set(id, { resolve });
      target.postMessage({ type: 'stats', id }, []);
    });
    return { workersCreated, opencvLoads: response.type === 'stats' ? response.opencvLoads : 0 };
  }

  return { detectWith, stats };
}

function browserWorker(): CvWorker | undefined {
  if (typeof Worker === 'undefined') return undefined;
  return new Worker(new URL('../workers/cv.worker.ts', import.meta.url), {
    type: 'module',
    name: 'cv',
  });
}

const client = createCvClient(browserWorker);

/**
 * Reads a board photo in the CV worker (docs/ARCHITECTURE.md → Computer vision). Progress events:
 * `loading-opencv` (first use only), `finding-board` (skipped when corners are given),
 * `classifying`. No detector for the game → `unavailable`; 20s without progress → `timeout`.
 */
export function detectBoard(
  gameId: GameId,
  image: ImageInput,
  corners?: Quad,
  options?: DetectBoardOptions,
): Promise<Result<Draft<unknown>, CvError>> {
  return client.detectWith(gameId, image, corners, options);
}

/** `detectBoard` for any detector id, including the development-only `_example`. */
export const detectWith = client.detectWith;

/** Workers created and opencv loads in this page session (both should stay at 1). */
export const cvStats = client.stats;

/** Decodes an image file into pixels, applying its EXIF orientation. */
export async function imageInputFromBlob(blob: Blob): Promise<ImageInput> {
  const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('2D canvas is unavailable');
  context.drawImage(bitmap, 0, 0);
  bitmap.close();
  const { data, width, height } = context.getImageData(0, 0, canvas.width, canvas.height);
  return { data, width, height };
}
