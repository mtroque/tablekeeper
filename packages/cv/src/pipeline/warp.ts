import type { Quad } from '@tablekeeper/core';

import { getCv, type Mat } from './opencv';

export type CanonicalSize = { width: number; height: number };

/** Perspective-warps the quad (TL, TR, BR, BL) to a `size` image. The caller deletes the result. */
export function warpToCanonical(mat: Mat, quad: Quad, size: CanonicalSize): Mat {
  const cv = getCv();
  const src = cv.matFromArray(
    4,
    1,
    cv.CV_32FC2,
    quad.flatMap((p) => [p.x, p.y]),
  );
  const { width: w, height: h } = size;
  const dst = cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, w, 0, w, h, 0, h]);
  const transform = cv.getPerspectiveTransform(src, dst);
  const out = new cv.Mat();
  cv.warpPerspective(mat, out, transform, new cv.Size(w, h), cv.INTER_LINEAR, cv.BORDER_REPLICATE);
  src.delete();
  dst.delete();
  transform.delete();
  return out;
}
