import type { Point, Quad } from '@tablekeeper/core';

import {
  centeredQuad,
  fitLine,
  intersectLines,
  orderQuad,
  polygonArea,
  quadAspect,
  segmentProjection,
  type Line,
} from './geometry';
import { getCv, type Mat, type MatVector } from './opencv';

export type FindBoardOptions = {
  /** The board's long side over its short side. */
  aspect: { min: number; max: number };
  /** Smallest board area as a share of the image. */
  minAreaRatio?: number;
};

export type BoardQuad = { quad: Quad; confidence: number; found: boolean };

export const BOARD_NOT_FOUND = "Couldn't find the board edges. Drag the corners into place.";

type Candidate = { quad: Quad; contour: Point[]; score: number; confidence: number };

/**
 * Finds the board as the largest convex 4-gon within the aspect bounds (blur, Canny, contours),
 * with corners refined by fitting a line to each side. Falls back to a centered quad.
 */
export function findBoardQuad(mat: Mat, opts: FindBoardOptions): BoardQuad {
  const cv = getCv();
  const minAreaRatio = opts.minAreaRatio ?? 0.1;
  const gray = new cv.Mat();
  const blurred = new cv.Mat();
  cv.cvtColor(mat, gray, cv.COLOR_RGB2GRAY);
  cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);
  gray.delete();

  const median = grayMedian(blurred);
  const edges = new cv.Mat();
  cv.Canny(blurred, edges, Math.max(8, 0.5 * median), Math.max(24, 1.2 * median));
  const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3, 3));
  cv.dilate(edges, edges, kernel);
  kernel.delete();

  let best = bestCandidate(edges, mat, opts.aspect, minAreaRatio);
  if (!best) {
    // Low-contrast edges: try separating the board from the table by brightness instead.
    const mask = new cv.Mat();
    for (const polarity of [cv.THRESH_BINARY, cv.THRESH_BINARY_INV]) {
      cv.threshold(blurred, mask, 0, 255, polarity + cv.THRESH_OTSU);
      best = bestCandidate(mask, mat, opts.aspect, minAreaRatio);
      if (best) break;
    }
    mask.delete();
  }
  edges.delete();
  blurred.delete();

  if (!best) return { quad: centeredQuad(mat.cols, mat.rows), confidence: 0, found: false };
  return { quad: refineCorners(best.quad, best.contour), confidence: best.confidence, found: true };
}

function bestCandidate(
  binary: Mat,
  image: Mat,
  aspect: FindBoardOptions['aspect'],
  minAreaRatio: number,
): Candidate | undefined {
  const cv = getCv();
  const imageArea = image.rows * image.cols;
  const contours: MatVector = new cv.MatVector();
  const hierarchy = new cv.Mat();
  cv.findContours(binary, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_NONE);
  hierarchy.delete();

  let best: Candidate | undefined;
  for (let i = 0; i < contours.size(); i++) {
    const contour = contours.get(i);
    const hull = new cv.Mat();
    const approx = new cv.Mat();
    try {
      cv.convexHull(contour, hull);
      const hullArea = cv.contourArea(hull);
      if (hullArea < minAreaRatio * imageArea || hullArea > 0.995 * imageArea) continue;
      cv.approxPolyDP(hull, approx, 0.02 * cv.arcLength(hull, true), true);
      if (approx.rows !== 4 || !cv.isContourConvex(approx)) continue;
      const quad = orderQuad(matPoints(approx));
      const ratio = quadAspect(quad);
      if (ratio < aspect.min || ratio > aspect.max) continue;
      const quadArea = polygonArea(quad);
      const fill = Math.min(1, cv.contourArea(contour) / quadArea);
      const hullFill = Math.min(1, hullArea / quadArea);
      if (touchesBorder(quad, image.cols, image.rows)) continue;
      const confidence =
        clamp01((fill - 0.6) / 0.35) *
        clamp01((hullFill - 0.9) / 0.08) *
        clamp01(quadArea / (0.2 * imageArea));
      const score = quadArea * (0.5 + 0.5 * confidence);
      if (!best || score > best.score) {
        best = { quad, contour: matPoints(contour), score, confidence: Math.max(0.3, confidence) };
      }
    } finally {
      contour.delete();
      hull.delete();
      approx.delete();
    }
  }
  contours.delete();
  return best;
}

/** A quad hugging the image border is the photo frame, not the board. */
function touchesBorder(quad: Quad, width: number, height: number): boolean {
  const margin = 2;
  const onBorder = quad.filter(
    (p) => p.x < margin || p.y < margin || p.x > width - 1 - margin || p.y > height - 1 - margin,
  );
  return onBorder.length >= 3;
}

/** Fits a line to the contour points along each side and intersects neighbors. */
function refineCorners(quad: Quad, contour: Point[]): Quad {
  const lines: Line[] = [];
  for (let side = 0; side < 4; side++) {
    const a = quad[side] as Point;
    const b = quad[(side + 1) % 4] as Point;
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    const near = Math.max(3, 0.015 * length);
    const points = contour.filter((p) => {
      const { distance, t } = segmentProjection(p, a, b);
      return distance <= near && t >= 0.1 && t <= 0.9;
    });
    const line = points.length >= 10 ? fitLine(points) : undefined;
    if (!line) return quad;
    lines.push(line);
  }
  const corners: Point[] = [];
  for (let i = 0; i < 4; i++) {
    const corner = intersectLines(lines[(i + 3) % 4] as Line, lines[i] as Line);
    const original = quad[i] as Point;
    // A refined corner far from the rough one means a bad fit; keep the rough corner.
    if (
      !corner ||
      Math.hypot(corner.x - original.x, corner.y - original.y) > 0.05 * Math.sqrt(polygonArea(quad))
    ) {
      corners.push(original);
    } else {
      corners.push(corner);
    }
  }
  return [corners[0] as Point, corners[1] as Point, corners[2] as Point, corners[3] as Point];
}

/** Points of a CV_32SC2 contour Mat. */
export function matPoints(mat: Mat): Point[] {
  const points: Point[] = [];
  const data = mat.data32S;
  for (let i = 0; i + 1 < data.length; i += 2) {
    points.push({ x: data[i] as number, y: data[i + 1] as number });
  }
  return points;
}

function grayMedian(gray: Mat): number {
  const histogram = new Array<number>(256).fill(0);
  const data = gray.data;
  for (let i = 0; i < data.length; i++) {
    const v = data[i] as number;
    histogram[v] = (histogram[v] as number) + 1;
  }
  let seen = 0;
  for (let v = 0; v < 256; v++) {
    seen += histogram[v] as number;
    if (seen >= data.length / 2) return v;
  }
  return 128;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
