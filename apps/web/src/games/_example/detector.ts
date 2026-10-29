import type { DetectorLoader } from '../detectors';

export const loadDetector: DetectorLoader | undefined = () =>
  import('@tablekeeper/cv/games/_example').then((m) => m.detector);
