import type { DetectorLoader } from '../detectors';

/** H2's photo detector, loaded inside the CV worker. */
export const loadDetector: DetectorLoader = () =>
  import('@tablekeeper/cv/games/harmonies').then((m) => m.detector);
