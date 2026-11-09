import type { DetectorLoader } from '../detectors';

/** Reads the box board's spaces and color (P2), loaded inside the CV worker. */
export const loadDetector: DetectorLoader | undefined = () =>
  import('@tablekeeper/cv/games/patchwork').then((m) => m.detector);
