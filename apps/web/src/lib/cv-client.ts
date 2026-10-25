import type { DetectStage, Draft, GameId, ImageInput, Quad, Result } from '@tablekeeper/core';

export type CvError = 'unavailable' | 'timeout' | 'failed';

export type DetectBoardOptions = {
  onProgress?: (stage: DetectStage) => void;
  signal?: AbortSignal;
};

/**
 * Reads a board photo in the CV worker (docs/ARCHITECTURE.md → Computer vision).
 * Until S2 lands the worker, photo reading is unavailable and the UI offers manual entry.
 */
export function detectBoard(
  _gameId: GameId,
  _image: ImageInput,
  _corners?: Quad,
  _options?: DetectBoardOptions,
): Promise<Result<Draft<unknown>, CvError>> {
  return Promise.resolve({ ok: false, error: 'unavailable' });
}
