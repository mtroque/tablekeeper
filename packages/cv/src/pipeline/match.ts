import { getCv, type Mat } from './opencv';

export type TemplateRef = { key: string; mat: Mat };

export type TemplateMatch = {
  key: string;
  /** Normalized correlation, -1 to 1. */
  score: number;
  /** Rotation of the crop, in degrees counterclockwise, that matched best. */
  angle: number;
  /** Best score per reference key. */
  scores: Record<string, number>;
};

export type MatchOptions = {
  /** Degrees between tried rotations. */
  angleStep?: number;
  /** Side the crop and references are resized to before comparing. */
  size?: number;
};

/**
 * Compares an RGB crop with reference crops at every rotation step, on the central part that stays
 * inside the image when rotated. Inputs are not changed or deleted.
 */
export function matchTemplateRotInvariant(
  crop: Mat,
  refs: readonly TemplateRef[],
  opts: MatchOptions = {},
): TemplateMatch {
  const cv = getCv();
  const { angleStep = 15, size = 48 } = opts;
  if (refs.length === 0) throw new Error('matchTemplateRotInvariant needs at least 1 reference');
  const inner = Math.floor(size * 0.7);
  const offset = Math.floor((size - inner) / 2);

  const square = (src: Mat): Mat => {
    const gray = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_RGB2GRAY);
    const out = new cv.Mat();
    cv.resize(gray, out, new cv.Size(size, size), 0, 0, cv.INTER_AREA);
    gray.delete();
    return out;
  };
  const central = (src: Mat): Mat => {
    const view = src.roi({ x: offset, y: offset, width: inner, height: inner });
    const copy = view.clone();
    view.delete();
    return copy;
  };

  const cropSquare = square(crop);
  const refCenters = refs.map((ref) => {
    const sq = square(ref.mat);
    const c = central(sq);
    sq.delete();
    return { key: ref.key, mat: c };
  });

  const scores: Record<string, number> = {};
  let best = { key: refs[0]?.key ?? '', score: -Infinity, angle: 0 };
  const rotated = new cv.Mat();
  const result = new cv.Mat();
  for (let angle = 0; angle < 360; angle += angleStep) {
    const m = cv.getRotationMatrix2D({ x: size / 2, y: size / 2 }, angle, 1);
    cv.warpAffine(
      cropSquare,
      rotated,
      m,
      new cv.Size(size, size),
      cv.INTER_LINEAR,
      cv.BORDER_REPLICATE,
    );
    m.delete();
    const c = central(rotated);
    for (const ref of refCenters) {
      cv.matchTemplate(c, ref.mat, result, cv.TM_CCOEFF_NORMED);
      const score = result.data32F[0] ?? -1;
      scores[ref.key] = Math.max(scores[ref.key] ?? -Infinity, score);
      if (score > best.score) best = { key: ref.key, score, angle };
    }
    c.delete();
  }
  rotated.delete();
  result.delete();
  cropSquare.delete();
  for (const ref of refCenters) ref.mat.delete();
  return { ...best, scores };
}
