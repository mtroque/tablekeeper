// The CV worker's detector lookup (docs/ARCHITECTURE.md → Computer vision). It imports only each
// game's detector.ts, never a UI module, so the worker stays free of React and the DOM.
import { isGameId, type Detector, type GameId } from '@tablekeeper/core';

import { isExampleGameEnabled } from '@/lib/env';

import { loadDetector as example } from './_example/detector';
import { loadDetector as azul } from './azul/detector';
import { loadDetector as dorfromantik } from './dorfromantik/detector';
import { loadDetector as harmonies } from './harmonies/detector';
import { loadDetector as patchwork } from './patchwork/detector';

/** Lazy-loads a game's detector inside the CV worker. */
export type DetectorLoader = () => Promise<Detector<unknown>>;

/** Every game's loader. Pre-registered: game slices edit their own detector.ts, never this file. */
const DETECTORS: Record<GameId, DetectorLoader | undefined> = {
  patchwork,
  azul,
  harmonies,
  dorfromantik,
};

/** A game's loader, or the S1 example game's outside production; `undefined` when there's none. */
export function findDetector(id: string): DetectorLoader | undefined {
  // Before isGameId, which also accepts the example game's id when it's enabled (D-040).
  if (id === '_example') return isExampleGameEnabled() ? example : undefined;
  return isGameId(id) ? DETECTORS[id] : undefined;
}
