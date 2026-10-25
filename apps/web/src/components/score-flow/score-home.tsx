'use client';

import type { GameDefinition } from '@tablekeeper/core';
import { PencilLine } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { PhotoCapture } from '@/components/photo-capture';
import { Button } from '@/components/ui/button';
import type { GameUiModule } from '@/games/types';

import { loadPhoto } from './photo';
import { manualFlow, type useFlow } from './use-flow';

/** Score home: photo, upload, sample photo, or manual entry. */
export function ScoreHome({
  game,
  ui,
  flow,
}: {
  game: GameDefinition;
  ui: GameUiModule;
  flow: ReturnType<typeof useFlow>;
}) {
  const router = useRouter();
  const base = `/games/${game.id}/score`;
  const [photoError, setPhotoError] = useState(false);

  const startPhoto = async (source: Blob | string) => {
    setPhotoError(false);
    try {
      const photo = await loadPhoto(source);
      flow.setFlow({ ...manualFlow(game), source: 'photo', photo });
      router.push(`${base}/capture`);
    } catch {
      setPhotoError(true);
    }
  };

  return (
    <section className="flex flex-col gap-6 px-4 py-5">
      {flow.flow && (
        <div className="flex flex-col gap-2 border-b border-line pb-5">
          <p className="text-muted">You have a board in progress.</p>
          <Button asChild variant="secondary">
            <Link href={`${base}/review`}>Continue Review</Link>
          </Button>
        </div>
      )}
      {game.features.photo && (
        <div className="flex flex-col gap-2">
          <h2 className="text-lg">Score from a Photo</h2>
          <PhotoCapture onPhoto={(file) => void startPhoto(file)} />
          {ui.samples && ui.samples.length > 0 && (
            <div className="flex flex-col gap-2 pt-2">
              <p className="text-sm text-muted">No board handy? Try one of ours.</p>
              {ui.samples.map((sample, i) => (
                <Button
                  key={sample}
                  variant="quiet"
                  onClick={() => void startPhoto(`/samples/${game.id}/${sample}`)}
                >
                  {ui.samples && ui.samples.length > 1
                    ? `Try Sample Photo ${i + 1}`
                    : 'Try Sample Photo'}
                </Button>
              ))}
            </div>
          )}
          {photoError && (
            <p className="text-danger" role="alert">
              Couldn&apos;t open that photo. Try another one.
            </p>
          )}
        </div>
      )}
      <div className="flex flex-col gap-2">
        {game.features.photo && <h2 className="text-lg">Or Enter by Hand</h2>}
        <Button
          variant={game.features.photo ? 'secondary' : 'primary'}
          onClick={() => {
            flow.setFlow(manualFlow(game));
            router.push(`${base}/review`);
          }}
        >
          <PencilLine />
          Enter by Hand
        </Button>
      </div>
    </section>
  );
}
