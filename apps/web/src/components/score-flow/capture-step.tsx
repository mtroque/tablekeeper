'use client';

import type { GameDefinition, Quad } from '@tablekeeper/core';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { CornerEditor } from '@/components/corner-editor';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { detectBoard, type CvError } from '@/lib/cv-client';
import type { FlowState } from '@/lib/session-store/flow-state';

import { defaultCorners, photoPixels } from './photo';
import { manualFlow, type useFlow } from './use-flow';

type Reading = { kind: 'reading' } | { kind: 'ready' } | { kind: 'failed'; error: CvError };

const STAGE_TEXT = {
  'loading-opencv': 'Getting ready to read the photo.',
  'finding-board': 'Finding the board edges.',
  classifying: 'Reading the spaces.',
} as const;

/** Photo with draggable corners; reading the board leads to review. */
export function CaptureStep({
  game,
  flow,
}: {
  game: GameDefinition;
  flow: ReturnType<typeof useFlow> & { flow: FlowState };
}) {
  const router = useRouter();
  const base = `/games/${game.id}/score`;
  const photo = flow.flow.photo;
  const [reading, setReading] = useState<Reading>({ kind: 'reading' });
  const [stage, setStage] = useState<keyof typeof STAGE_TEXT | null>(null);
  const started = useRef(false);
  // Set when the player leaves for manual entry, so dropping the photo doesn't send them home.
  const leaving = useRef(false);

  const corners = (flow.flow.corners as Quad | null) ?? (photo ? defaultCorners(photo) : null);

  const read = async (userCorners?: Quad) => {
    if (!photo) return;
    setReading({ kind: 'reading' });
    try {
      const pixels = await photoPixels(photo);
      const result = await detectBoard(game.id, pixels, userCorners, { onProgress: setStage });
      if (!result.ok) {
        setReading({ kind: 'failed', error: result.error });
        return;
      }
      const draft = result.value;
      if (userCorners) {
        flow.setFlow({
          ...flow.flow,
          state: draft.state,
          draft: { state: draft.state, confidence: draft.confidence },
          corners: draft.corners,
          warnings: draft.warnings,
        });
        router.push(`${base}/review`);
      } else {
        flow.setFlow({ ...flow.flow, corners: draft.corners, warnings: draft.warnings });
        setReading({ kind: 'ready' });
      }
    } catch {
      setReading({ kind: 'failed', error: 'failed' });
    }
  };

  // Find the corners once when the photo arrives; the player adjusts them after.
  // Without a photo (a manual board), capture has nothing to show.
  useEffect(() => {
    if (!photo) {
      if (!leaving.current) router.replace(base);
      return;
    }
    if (started.current) return;
    started.current = true;
    void read();
  });

  const manual = () => {
    leaving.current = true;
    flow.setFlow(manualFlow(game));
    router.push(`${base}/review`);
  };

  if (!photo || !corners) return null;

  return (
    <section className="flex flex-col gap-4 py-4">
      <h2 className="px-4 text-lg">Check the Corners</h2>
      <CornerEditor
        src={photo.src}
        size={photo}
        corners={corners}
        onChange={(next) => {
          flow.setFlow({ ...flow.flow, corners: next });
        }}
      />
      <div className="flex flex-col gap-3 px-4">
        {reading.kind === 'reading' && (
          <div role="status" className="flex flex-col gap-2">
            <p className="text-muted">{stage ? STAGE_TEXT[stage] : 'Opening the photo.'}</p>
            <Skeleton className="h-2 w-full" />
          </div>
        )}
        {reading.kind === 'failed' && (
          <div role="alert" className="flex flex-col gap-3">
            <p>
              {reading.error === 'unavailable'
                ? "Photo reading isn't available yet."
                : reading.error === 'timeout'
                  ? 'Reading the photo took too long.'
                  : "Couldn't read the photo."}
            </p>
            {reading.error !== 'unavailable' && (
              <Button variant="secondary" onClick={() => void read(corners)}>
                Try Again
              </Button>
            )}
            <Button onClick={manual}>Enter by Hand</Button>
          </div>
        )}
        {reading.kind === 'ready' && (
          <>
            {flow.flow.warnings.map((warning) => (
              <p key={warning} className="rounded-card bg-warn-soft px-3 py-2">
                {warning}
              </p>
            ))}
            <p className="text-muted">Drag the corners onto the board&apos;s corners.</p>
            <Button onClick={() => void read(corners)}>Read Board</Button>
            <Button variant="quiet" onClick={manual}>
              Enter by Hand
            </Button>
          </>
        )}
      </div>
    </section>
  );
}
