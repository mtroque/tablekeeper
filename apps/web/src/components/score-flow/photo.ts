import type { ImageInput, Quad } from '@tablekeeper/core';

/** Longest side kept for the photo; matches the CV pipeline's `maxSide`. */
const MAX_SIDE = 1600;

export type FlowPhoto = { src: string; width: number; height: number };

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve(img);
    };
    img.onerror = () => {
      reject(new Error('Image failed to load'));
    };
    img.src = src;
  });
}

/** A photo file or URL, downscaled to a JPEG data URL small enough for sessionStorage. */
export async function loadPhoto(source: Blob | string): Promise<FlowPhoto> {
  const url = typeof source === 'string' ? source : URL.createObjectURL(source);
  try {
    const img = await loadImage(url);
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const width = Math.round(img.naturalWidth * scale);
    const height = Math.round(img.naturalHeight * scale);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('No canvas');
    context.drawImage(img, 0, 0, width, height);
    return { src: canvas.toDataURL('image/jpeg', 0.82), width, height };
  } finally {
    if (typeof source !== 'string') URL.revokeObjectURL(url);
  }
}

/** The photo's pixels for the CV worker. */
export async function photoPixels(photo: FlowPhoto): Promise<ImageInput> {
  const img = await loadImage(photo.src);
  const canvas = document.createElement('canvas');
  canvas.width = photo.width;
  canvas.height = photo.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('No canvas');
  context.drawImage(img, 0, 0);
  const data = context.getImageData(0, 0, photo.width, photo.height);
  return { data: data.data, width: data.width, height: data.height };
}

/** Default corners: the middle of the photo, inset 10%. */
export function defaultCorners({ width, height }: FlowPhoto): Quad {
  const x = width * 0.1;
  const y = height * 0.1;
  return [
    { x, y },
    { x: width - x, y },
    { x: width - x, y: height - y },
    { x, y: height - y },
  ];
}
