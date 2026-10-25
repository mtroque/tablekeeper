// Board reading (docs/ARCHITECTURE.md → Computer vision). Game detectors live in
// `games/<gameId>/` and are imported as `@tablekeeper/cv/games/<gameId>`.
export type { Detector, Draft } from '@tablekeeper/core';

export {
  loadOpenCv,
  setOpenCvLoader,
  getCv,
  isOpenCvLoaded,
  openCvLoadCount,
  deleteMats,
  type Mat,
  type MatVector,
  type OpenCv,
} from './pipeline/opencv';
export * from './pipeline/geometry';
export { readExifOrientation } from './pipeline/exif';
export { loadImage, type LoadImageOptions, type LoadedImage } from './pipeline/load-image';
export {
  findBoardQuad,
  BOARD_NOT_FOUND,
  type BoardQuad,
  type FindBoardOptions,
} from './pipeline/find-board';
export { warpToCanonical, type CanonicalSize } from './pipeline/warp';
export { normalizeLighting, type NormalizeOptions } from './pipeline/normalize';
export { sampleCells, squareGridLayout, type BoardLayout, type CellRegion } from './pipeline/cells';
export {
  cellFeatures,
  featureVector,
  rgbToLab,
  FEATURE_NAMES,
  type CellFeatures,
  type FeatureName,
} from './pipeline/features';
export {
  classifyNearest,
  calibrateProfile,
  scaledDistance,
  ProfileSchema,
  type Classification,
  type Profile,
} from './pipeline/profile';
export { findBlobs, type Blob, type FindBlobsOptions } from './pipeline/blobs';
export {
  matchTemplateRotInvariant,
  type MatchOptions,
  type TemplateMatch,
  type TemplateRef,
} from './pipeline/match';
export {
  measureBoard,
  runBoardPipeline,
  type BoardMeasure,
  type BoardReading,
  type CellMeasure,
  type CellReading,
  type GridBoard,
  type PipelineOptions,
} from './pipeline/board-pipeline';
export { createGridGame, type CvGame } from './pipeline/game';

/** Below this a detected value is flagged for review. */
export const LOW_CONFIDENCE = 0.6;
