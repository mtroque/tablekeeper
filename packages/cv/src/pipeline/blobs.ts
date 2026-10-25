import type { Point } from '@tablekeeper/core';

import { getCv, type CvRect, type CvRotatedRect, type Mat } from './opencv';

export type Blob = {
  area: number;
  perimeter: number;
  /** 4πA / P², 1 for a circle. */
  circularity: number;
  rotatedRect: CvRotatedRect;
  boundingBox: CvRect;
  centroid: Point;
  /** Mean RGB of the image under the blob's bounding box and mask. */
  meanRgb: [number, number, number];
};

export type FindBlobsOptions = {
  minArea?: number;
  maxArea?: number;
  minCircularity?: number;
};

/**
 * Connected regions of a binary mask (tokens beside a board), measured on the RGB image. Neither
 * input is changed or deleted.
 */
export function findBlobs(mat: Mat, mask: Mat, opts: FindBlobsOptions = {}): Blob[] {
  const cv = getCv();
  const { minArea = 20, maxArea = Number.POSITIVE_INFINITY, minCircularity = 0 } = opts;
  const work = mask.clone();
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  cv.findContours(work, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_NONE);
  work.delete();
  hierarchy.delete();

  const blobs: Blob[] = [];
  for (let i = 0; i < contours.size(); i++) {
    const contour = contours.get(i);
    const area = cv.contourArea(contour);
    const perimeter = cv.arcLength(contour, true);
    const circularity = perimeter > 0 ? (4 * Math.PI * area) / perimeter ** 2 : 0;
    if (area >= minArea && area <= maxArea && circularity >= minCircularity) {
      const rotatedRect = cv.minAreaRect(contour);
      const boundingBox = contourBounds(contour);
      blobs.push({
        area,
        perimeter,
        circularity: Math.min(1, circularity),
        rotatedRect: {
          center: { x: rotatedRect.center.x, y: rotatedRect.center.y },
          size: { width: rotatedRect.size.width, height: rotatedRect.size.height },
          angle: rotatedRect.angle,
        },
        boundingBox,
        centroid: { x: rotatedRect.center.x, y: rotatedRect.center.y },
        meanRgb: maskedMean(mat, mask, boundingBox),
      });
    }
    contour.delete();
  }
  contours.delete();
  return blobs.sort((a, b) => b.area - a.area);
}

function contourBounds(contour: Mat): CvRect {
  const data = contour.data32S;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (let i = 0; i + 1 < data.length; i += 2) {
    const x = data[i] as number;
    const y = data[i + 1] as number;
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  }
  return { x: x0, y: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
}

function maskedMean(mat: Mat, mask: Mat, box: CvRect): [number, number, number] {
  const channels = mat.channels();
  const sums = [0, 0, 0];
  let count = 0;
  for (let y = box.y; y < box.y + box.height; y++) {
    for (let x = box.x; x < box.x + box.width; x++) {
      if (!mask.data[y * mask.cols + x]) continue;
      const i = (y * mat.cols + x) * channels;
      for (let c = 0; c < 3; c++) sums[c] = (sums[c] as number) + (mat.data[i + c] as number);
      count++;
    }
  }
  const safe = Math.max(1, count);
  return [(sums[0] as number) / safe, (sums[1] as number) / safe, (sums[2] as number) / safe];
}
