import type { DetectStage, Draft } from '@tablekeeper/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createCvClient, type CvRequest, type CvResponse, type CvWorker } from './cv-client';

const IMAGE = { data: new Uint8ClampedArray(4 * 4 * 4), width: 4, height: 4 };
const P = { x: 0, y: 0 };
const DRAFT: Draft<unknown> = { state: {}, confidence: {}, corners: [P, P, P, P], warnings: [] };

/** A worker that records requests and replies when told to. */
class FakeWorker implements CvWorker {
  onmessage: CvWorker['onmessage'] = null;
  onerror: CvWorker['onerror'] = null;
  requests: CvRequest[] = [];
  transfers: Transferable[][] = [];
  terminated = false;

  postMessage(message: CvRequest, transfer: Transferable[]) {
    this.requests.push(message);
    this.transfers.push(transfer);
  }
  terminate() {
    this.terminated = true;
  }
  reply(message: CvResponse) {
    this.onmessage?.({ data: message } as MessageEvent<CvResponse>);
  }
  lastId() {
    return this.requests.at(-1)!.id;
  }
}

let workers: FakeWorker[];
const factory = () => {
  const worker = new FakeWorker();
  workers.push(worker);
  return worker;
};

beforeEach(() => {
  workers = [];
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('cv-client', () => {
  it('sends a copy of the image, relays progress and resolves with the draft', async () => {
    const client = createCvClient(factory);
    const stages: DetectStage[] = [];
    const pending = client.detectWith('_example', IMAGE, undefined, {
      onProgress: (s) => stages.push(s),
    });
    const worker = workers[0]!;
    const request = worker.requests[0]!;
    expect(request).toMatchObject({ type: 'detect', detectorId: '_example' });
    expect(request.type === 'detect' && request.image.data).not.toBe(IMAGE.data);
    expect(worker.transfers[0]).toHaveLength(1);
    worker.reply({ type: 'progress', id: request.id, stage: 'loading-opencv' });
    worker.reply({ type: 'progress', id: request.id, stage: 'classifying' });
    worker.reply({ type: 'result', id: request.id, result: { ok: true, value: DRAFT } });
    await expect(pending).resolves.toEqual({ ok: true, value: DRAFT });
    expect(stages).toEqual(['loading-opencv', 'classifying']);
  });

  it('keeps one worker across calls and reports stats', async () => {
    const client = createCvClient(factory);
    for (let i = 0; i < 2; i++) {
      const pending = client.detectWith('_example', IMAGE);
      workers[0]!.reply({
        type: 'result',
        id: workers[0]!.lastId(),
        result: { ok: true, value: DRAFT },
      });
      await pending;
    }
    expect(workers).toHaveLength(1);
    const stats = client.stats();
    workers[0]!.reply({ type: 'stats', id: workers[0]!.lastId(), opencvLoads: 1 });
    await expect(stats).resolves.toEqual({ workersCreated: 1, opencvLoads: 1 });
  });

  it('times out after 20s without progress, restarting the clock on each progress event', async () => {
    const client = createCvClient(factory);
    const pending = client.detectWith('_example', IMAGE);
    const worker = workers[0]!;
    vi.advanceTimersByTime(15_000);
    worker.reply({ type: 'progress', id: worker.lastId(), stage: 'loading-opencv' });
    vi.advanceTimersByTime(15_000);
    expect(worker.terminated).toBe(false);
    vi.advanceTimersByTime(5_001);
    await expect(pending).resolves.toEqual({ ok: false, error: 'timeout' });
    expect(worker.terminated).toBe(true);

    // The next call starts a fresh worker.
    const next = client.detectWith('_example', IMAGE);
    expect(workers).toHaveLength(2);
    workers[1]!.reply({
      type: 'result',
      id: workers[1]!.lastId(),
      result: { ok: true, value: DRAFT },
    });
    await expect(next).resolves.toMatchObject({ ok: true });
  });

  it('an aborted call resolves as failed', async () => {
    const client = createCvClient(factory);
    const controller = new AbortController();
    const pending = client.detectWith('_example', IMAGE, undefined, { signal: controller.signal });
    controller.abort();
    await expect(pending).resolves.toEqual({ ok: false, error: 'failed' });
    controller.abort();
    await expect(
      client.detectWith('_example', IMAGE, undefined, { signal: controller.signal }),
    ).resolves.toEqual({ ok: false, error: 'failed' });
  });

  it('a crashed worker fails pending calls and is replaced', async () => {
    const client = createCvClient(factory);
    const pending = client.detectWith('_example', IMAGE);
    workers[0]!.onerror?.({} as ErrorEvent);
    await expect(pending).resolves.toEqual({ ok: false, error: 'failed' });
    void client.detectWith('_example', IMAGE);
    expect(workers).toHaveLength(2);
  });

  it('is unavailable without worker support', async () => {
    const client = createCvClient(() => undefined);
    await expect(client.detectWith('patchwork', IMAGE)).resolves.toEqual({
      ok: false,
      error: 'unavailable',
    });
  });

  it('passes the worker error through', async () => {
    const client = createCvClient(factory);
    const pending = client.detectWith('azul', IMAGE);
    workers[0]!.reply({
      type: 'result',
      id: workers[0]!.lastId(),
      result: { ok: false, error: 'unavailable' },
    });
    await expect(pending).resolves.toEqual({ ok: false, error: 'unavailable' });
  });
});
