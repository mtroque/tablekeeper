// The subset of opencv.js the pipeline uses, typed tightly (the package's own typings are mostly
// `any`), and the one shared loader.

export type CvSize = { width: number; height: number };
export type CvPoint = { x: number; y: number };
export type CvRect = { x: number; y: number; width: number; height: number };
export type CvRotatedRect = { center: CvPoint; size: CvSize; angle: number };
/** cv.Scalar is array-like: up to 4 channel values. */
export type CvScalar = number[];

export interface Mat {
  rows: number;
  cols: number;
  data: Uint8Array;
  data32F: Float32Array;
  data32S: Int32Array;
  data64F: Float64Array;
  type(): number;
  channels(): number;
  clone(): Mat;
  roi(rect: CvRect): Mat;
  copyTo(dst: Mat, mask?: Mat): void;
  convertTo(dst: Mat, rtype: number, alpha?: number, beta?: number): void;
  setTo(value: CvScalar, mask?: Mat): Mat;
  delete(): void;
  isDeleted(): boolean;
}

export interface MatVector {
  size(): number;
  get(index: number): Mat;
  push_back(mat: Mat): void;
  delete(): void;
  isDeleted(): boolean;
}

export interface Clahe {
  apply(src: Mat, dst: Mat): void;
  delete(): void;
}

export interface MatConstructor {
  new (): Mat;
  new (rows: number, cols: number, type: number, value?: CvScalar): Mat;
  prototype: Mat;
}

export interface OpenCv {
  Mat: MatConstructor;
  MatVector: { new (): MatVector; prototype: MatVector };
  CLAHE: new (clipLimit: number, tileGridSize: CvSize) => Clahe;
  Size: new (width: number, height: number) => CvSize;
  Point: new (x: number, y: number) => CvPoint;
  Scalar: new (...values: number[]) => CvScalar;

  matFromArray(rows: number, cols: number, type: number, values: number[]): Mat;
  getPerspectiveTransform(src: Mat, dst: Mat): Mat;
  getRotationMatrix2D(center: CvPoint, angle: number, scale: number): Mat;
  getStructuringElement(shape: number, size: CvSize): Mat;

  cvtColor(src: Mat, dst: Mat, code: number, dstCn?: number): void;
  GaussianBlur(src: Mat, dst: Mat, ksize: CvSize, sigmaX: number, sigmaY?: number): void;
  Canny(src: Mat, dst: Mat, threshold1: number, threshold2: number): void;
  dilate(src: Mat, dst: Mat, kernel: Mat): void;
  threshold(src: Mat, dst: Mat, thresh: number, maxval: number, type: number): number;
  findContours(image: Mat, contours: MatVector, hierarchy: Mat, mode: number, method: number): void;
  contourArea(contour: Mat): number;
  arcLength(curve: Mat, closed: boolean): number;
  approxPolyDP(curve: Mat, approx: Mat, epsilon: number, closed: boolean): void;
  convexHull(points: Mat, hull: Mat): void;
  isContourConvex(contour: Mat): boolean;
  minAreaRect(points: Mat): CvRotatedRect;
  warpPerspective(
    src: Mat,
    dst: Mat,
    m: Mat,
    dsize: CvSize,
    flags?: number,
    borderMode?: number,
    borderValue?: CvScalar,
  ): void;
  warpAffine(
    src: Mat,
    dst: Mat,
    m: Mat,
    dsize: CvSize,
    flags?: number,
    borderMode?: number,
    borderValue?: CvScalar,
  ): void;
  resize(src: Mat, dst: Mat, dsize: CvSize, fx?: number, fy?: number, interpolation?: number): void;
  rotate(src: Mat, dst: Mat, rotateCode: number): void;
  flip(src: Mat, dst: Mat, flipCode: number): void;
  split(src: Mat, channels: MatVector): void;
  merge(channels: MatVector, dst: Mat): void;
  matchTemplate(image: Mat, templ: Mat, result: Mat, method: number): void;
  minMaxLoc(src: Mat): { minVal: number; maxVal: number; minLoc: CvPoint; maxLoc: CvPoint };
  fillPoly(img: Mat, pts: MatVector, color: CvScalar, lineType?: number): void;
  rectangle(
    img: Mat,
    p1: CvPoint,
    p2: CvPoint,
    color: CvScalar,
    thickness?: number,
    lineType?: number,
  ): void;
  circle(
    img: Mat,
    center: CvPoint,
    radius: number,
    color: CvScalar,
    thickness?: number,
    lineType?: number,
  ): void;

  CV_8UC1: number;
  CV_8UC3: number;
  CV_8UC4: number;
  CV_32F: number;
  CV_32FC2: number;
  CV_32SC2: number;
  COLOR_RGBA2RGB: number;
  COLOR_RGB2GRAY: number;
  COLOR_RGB2Lab: number;
  COLOR_Lab2RGB: number;
  RETR_EXTERNAL: number;
  CHAIN_APPROX_NONE: number;
  INTER_AREA: number;
  INTER_LINEAR: number;
  BORDER_CONSTANT: number;
  BORDER_REPLICATE: number;
  ROTATE_90_CLOCKWISE: number;
  ROTATE_180: number;
  ROTATE_90_COUNTERCLOCKWISE: number;
  TM_CCOEFF_NORMED: number;
  THRESH_BINARY: number;
  THRESH_BINARY_INV: number;
  THRESH_OTSU: number;
  MORPH_RECT: number;
  LINE_AA: number;
}

let instance: OpenCv | undefined;
let loading: Promise<OpenCv> | undefined;
let loads = 0;
let loader: () => Promise<unknown> = () => import('@techstark/opencv-js');

function isOpenCv(value: unknown): value is OpenCv {
  return (
    typeof value === 'object' && value !== null && typeof Reflect.get(value, 'Mat') === 'function'
  );
}

/**
 * Replaces how the opencv.js package is imported, before the first load. Node callers (tests, the
 * eval) pass a `require`-based loader (`../node.ts`): Vitest's CommonJS interop turns the package's
 * promise export into a thenable namespace that `import()` can't resolve.
 */
export function setOpenCvLoader(load: () => Promise<unknown>): void {
  if (loading) throw new Error('opencv.js is already loading');
  loader = load;
}

/**
 * Loads opencv.js once; every caller shares the same promise. The package exports a promise of the
 * ready module (or the module itself in older builds), possibly as a namespace's default.
 */
export function loadOpenCv(): Promise<OpenCv> {
  loading ??= loader().then(async (mod: unknown) => {
    loads += 1;
    const exported: unknown = isOpenCv(mod)
      ? mod
      : typeof mod === 'object' && mod !== null && 'default' in mod
        ? mod.default
        : mod;
    const ready: unknown = await exported;
    if (!isOpenCv(ready)) throw new Error('opencv.js did not load');
    instance = ready;
    return ready;
  });
  return loading;
}

/** The loaded opencv module. Stages call this; `loadOpenCv()` must have resolved first. */
export function getCv(): OpenCv {
  if (!instance) throw new Error('opencv.js is not loaded; await loadOpenCv() first');
  return instance;
}

export function isOpenCvLoaded(): boolean {
  return instance !== undefined;
}

/** How many times opencv.js was actually loaded in this realm (should stay at 1). */
export function openCvLoadCount(): number {
  return loads;
}

/** Deletes every given Mat that is still alive. */
export function deleteMats(...mats: Array<Mat | MatVector | undefined>): void {
  for (const mat of mats) {
    if (mat && !mat.isDeleted()) mat.delete();
  }
}
