import type { DetectorLoader } from '../detectors';

/** Reads the box board and the praline chits beside it, loaded inside the CV worker. */
export const loadDetector: DetectorLoader | undefined = () =>
  import('@tablekeeper/cv/games/patchwork').then((m) => m.detector);
