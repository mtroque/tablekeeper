// A game's own calibration for `pnpm eval:cv <gameId> --calibrate`, when its CvGame has
// `calibrate` (packages/cv/src/pipeline/game.ts). Games without it get the generic profile.json.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import jpeg from 'jpeg-js';
import prettier from 'prettier';

import type { ImageInput, Quad } from '../../packages/core/src';
import { readExifOrientation } from '../../packages/cv/src';
import type { CvGame } from '../../packages/cv/src';

export type CalibrationItem<Label> = {
  name: string;
  image: ImageInput;
  orientation?: number;
  corners?: Quad;
  label: Label;
};

/** A plain JSON file name, so a game can't write outside its own folder. */
const FILE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*\.json$/;

export function decodeJpeg(bytes: Buffer): ImageInput {
  const raw = jpeg.decode(bytes, { useTArray: true, formatAsRGBA: true, maxMemoryUsageInMB: 1024 });
  return {
    data: new Uint8ClampedArray(raw.data.buffer, raw.data.byteOffset, raw.data.length),
    width: raw.width,
    height: raw.height,
  };
}

/** Every JPEG in `<fixturesDir>/references/`, named `references/<file>`, sorted by name. */
export function readReferences(
  fixturesDir: string,
): Array<{ name: string; image: ImageInput; orientation?: number }> {
  const dir = join(fixturesDir, 'references');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((file) => /\.jpe?g$/i.test(file))
    .sort()
    .map((file) => {
      const bytes = readFileSync(join(dir, file));
      return {
        name: `references/${file}`,
        image: decodeJpeg(bytes),
        orientation: readExifOrientation(bytes),
      };
    });
}

/**
 * Runs the game's `calibrate` and writes each returned file into `gameDir` as Prettier-formatted
 * JSON. Returns the calibrated game, the files written and the game's summary.
 */
export async function runGameCalibration<State, Label>(opts: {
  game: CvGame<State, Label>;
  fixturesDir: string;
  gameDir: string;
  items: Array<CalibrationItem<Label>>;
}): Promise<{ game: CvGame<State, Label>; written: string[]; summary: string[] }> {
  if (!opts.game.calibrate) throw new Error('The game has no calibrate.');
  const result = await opts.game.calibrate({
    references: readReferences(opts.fixturesDir),
    items: opts.items,
  });
  const names = Object.keys(result.files);
  const bad = names.find((name) => !FILE_NAME.test(name));
  if (bad !== undefined) throw new Error(`calibrate returned a bad file name: ${bad}`);
  for (const name of names) {
    const file = join(opts.gameDir, name);
    const options = (await prettier.resolveConfig(file)) ?? {};
    writeFileSync(
      file,
      await prettier.format(JSON.stringify(result.files[name]), { ...options, parser: 'json' }),
    );
  }
  return { game: result.game, written: names, summary: result.summary };
}
