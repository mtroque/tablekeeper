'use client';

import { Camera, ImageUp } from 'lucide-react';
import { useRef } from 'react';

import { Button } from '@/components/ui/button';

/** Camera or gallery input. The parent shows the preview and runs detection on `onPhoto`. */
export function PhotoCapture({
  onPhoto,
  disabled = false,
}: {
  onPhoto: (file: File) => void;
  disabled?: boolean;
}) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const take = (input: HTMLInputElement) => {
    const file = input.files?.[0];
    // Reset so choosing the same photo again still fires a change.
    input.value = '';
    if (file) onPhoto(file);
  };

  return (
    <div className="flex flex-col gap-2">
      <Button disabled={disabled} onClick={() => cameraRef.current?.click()}>
        <Camera />
        Take Photo
      </Button>
      <Button variant="secondary" disabled={disabled} onClick={() => galleryRef.current?.click()}>
        <ImageUp />
        Upload Photo
      </Button>
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(event) => {
          take(event.currentTarget);
        }}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        data-testid="photo-upload"
        onChange={(event) => {
          take(event.currentTarget);
        }}
      />
    </div>
  );
}
