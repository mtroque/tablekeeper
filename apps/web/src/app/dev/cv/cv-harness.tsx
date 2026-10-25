'use client';

import type { DetectStage, Draft } from '@tablekeeper/core';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  cvStats,
  detectWith,
  imageInputFromBlob,
  type CvError,
  type CvStats,
} from '@/lib/cv-client';

const SAMPLE = '/dev/cv/example-board.jpg';

const STAGE_TEXT: Record<DetectStage, string> = {
  'loading-opencv': 'Loading the board reader.',
  'finding-board': 'Finding the board.',
  classifying: 'Reading the spaces.',
};

const ERROR_TEXT: Record<CvError, string> = {
  unavailable: "Photo reading isn't available in this browser.",
  timeout: 'Reading took too long.',
  failed: "Couldn't read the photo.",
};

type ExampleState = { cells: boolean[] };

type Status =
  | { kind: 'idle' }
  | { kind: 'reading'; stage?: DetectStage }
  | { kind: 'done'; draft: Draft<ExampleState>; ms: number; longestPause: number; stats: CvStats }
  | { kind: 'error'; error: CvError };

/** Reads a synthetic example board with the real worker and shows what came back. */
export function CvHarness() {
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  async function read() {
    setStatus({ kind: 'reading' });
    const image = await imageInputFromBlob(await (await fetch(SAMPLE)).blob());
    // How long the main thread went without running a 16ms timer while the worker read.
    let last = performance.now();
    let longestPause = 0;
    const ticker = setInterval(() => {
      const now = performance.now();
      longestPause = Math.max(longestPause, now - last);
      last = now;
    }, 16);
    const start = performance.now();
    const result = await detectWith('_example', image, undefined, {
      onProgress: (stage) => {
        setStatus({ kind: 'reading', stage });
      },
    });
    const ms = performance.now() - start;
    clearInterval(ticker);
    if (!result.ok) {
      setStatus({ kind: 'error', error: result.error });
      return;
    }
    setStatus({
      kind: 'done',
      draft: result.value as Draft<ExampleState>,
      ms,
      longestPause,
      stats: await cvStats(),
    });
  }

  return (
    <section className="flex flex-col gap-4 px-4 py-6">
      <h1 className="text-2xl">Board Reader Check</h1>
      <p className="text-muted">
        Reads a synthetic photo of the example board in the background worker.
      </p>
      {/* eslint-disable-next-line @next/next/no-img-element -- a fixed local sample, no optimization needed */}
      <img
        src={SAMPLE}
        alt="Synthetic example board"
        className="w-full rounded-[10px] border border-line"
      />
      <Button onClick={() => void read()} disabled={status.kind === 'reading'}>
        {status.kind === 'error' ? 'Try Again' : 'Read Board'}
      </Button>

      {status.kind === 'reading' && (
        <p data-testid="cv-stage">
          {status.stage ? STAGE_TEXT[status.stage] : 'Opening the photo.'}
        </p>
      )}

      {status.kind === 'error' && (
        <p className="text-danger" data-testid="cv-error">
          {ERROR_TEXT[status.error]}
        </p>
      )}

      {status.kind === 'done' && (
        <div className="flex flex-col gap-3" data-testid="cv-result">
          <div className="grid w-48 grid-cols-3 gap-1">
            {status.draft.state.cells.map((covered, i) => {
              const r = Math.floor(i / 3);
              const c = i % 3;
              const confidence = status.draft.confidence[`${r},${c}`] ?? 0;
              return (
                <div
                  key={`${r},${c}`}
                  data-testid={`cell-${r}-${c}`}
                  data-covered={covered}
                  className={`flex aspect-square items-center justify-center rounded-[6px] border text-sm tabular-nums ${
                    covered ? 'bg-ink text-bg' : 'bg-surface'
                  } ${confidence < 0.6 ? 'border-dashed border-warn' : 'border-line'}`}
                >
                  {confidence.toFixed(2)}
                </div>
              );
            })}
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm tabular-nums">
            <dt className="text-muted">Time</dt>
            <dd data-testid="cv-ms">{status.ms.toFixed(0)} ms</dd>
            <dt className="text-muted">Longest Pause</dt>
            <dd data-testid="cv-pause">{status.longestPause.toFixed(0)} ms</dd>
            <dt className="text-muted">Workers</dt>
            <dd data-testid="cv-workers">{status.stats.workersCreated}</dd>
            <dt className="text-muted">Reader Loads</dt>
            <dd data-testid="cv-loads">{status.stats.opencvLoads}</dd>
            <dt className="text-muted">Warnings</dt>
            <dd>{status.draft.warnings.join(' ') || 'None'}</dd>
          </dl>
        </div>
      )}
    </section>
  );
}
