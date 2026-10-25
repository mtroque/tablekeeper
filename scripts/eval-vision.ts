// pnpm eval:cv <gameId> [--calibrate]
// Runs a game's detector on data/fixtures/<gameId> and reports board-found rate, corner error,
// per-cell accuracy, the confusion matrix, how many errors were flagged low-confidence, and timing
// (docs/ARCHITECTURE.md → Computer vision). Writes data/fixtures/<gameId>/eval-report.md and exits 1
// below the fixture set's accuracy threshold. --calibrate rebuilds games/<gameId>/profile.json.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import jpeg from 'jpeg-js';
import prettier from 'prettier';

import type { ImageInput, Point, Quad } from '../packages/core/src';
import {
  calibrateProfile,
  cornerError,
  LOW_CONFIDENCE,
  readExifOrientation,
} from '../packages/cv/src';
import type { CvGame } from '../packages/cv/src';
import { loadOpenCvInNode } from '../packages/cv/src/node';
import { FixtureSetSchema } from '../packages/cv/src/pipeline/fixtures';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const args = process.argv.slice(2);
const gameId = args.find((arg) => !arg.startsWith('--'));
const calibrate = args.includes('--calibrate');
if (!gameId || !/^_?[a-z][a-z0-9-]*$/.test(gameId)) {
  console.error('Usage: pnpm eval:cv <gameId> [--calibrate]');
  process.exit(2);
}

const fixturesDir = join(ROOT, 'data/fixtures', gameId);
const gameDir = join(ROOT, 'packages/cv/src/games', gameId);
if (!existsSync(join(fixturesDir, 'labels.json')))
  fail(`No fixtures at data/fixtures/${gameId}/labels.json.`);
if (!existsSync(join(gameDir, 'index.ts')))
  fail(`No detector at packages/cv/src/games/${gameId}/index.ts.`);

const fixtures = FixtureSetSchema.parse(
  JSON.parse(readFileSync(join(fixturesDir, 'labels.json'), 'utf8')),
);
let game = await loadGame(join(gameDir, 'index.ts'));
await loadOpenCvInNode();

const items = fixtures.items.map((item) => {
  const bytes = readFileSync(join(fixturesDir, item.image));
  const label = game.labelSchema.parse(item.label);
  return {
    name: item.image,
    image: decode(bytes),
    orientation: readExifOrientation(bytes),
    corners: item.corners ? toQuad(item.corners) : undefined,
    truth: game.cellTruth(label),
  };
});

if (calibrate) {
  const samples: Array<{ label: string; features: number[] }> = [];
  for (const item of items) {
    if (!item.corners) fail(`${item.name} has no corners; calibration needs labeled corners.`);
    const cells = await game.measure(item.image, item.corners, { orientation: item.orientation });
    for (const cell of cells) {
      const label = item.truth[cell.key];
      if (label === undefined) fail(`${item.name}: no label for cell ${cell.key}.`);
      samples.push({ label, features: cell.features });
    }
  }
  const profile = calibrateProfile(samples, game.features);
  game = game.withProfile(profile);
  const file = join(gameDir, 'profile.json');
  const options = (await prettier.resolveConfig(file)) ?? {};
  writeFileSync(
    file,
    await prettier.format(JSON.stringify(profile), { ...options, parser: 'json' }),
  );
  console.log(
    `Calibrated ${Object.keys(profile.classes).length} classes from ${samples.length} cells.`,
  );
  console.log(
    `Wrote packages/cv/src/games/${gameId}/profile.json (tolerance ${profile.tolerance}).`,
  );
}

// Evaluation always runs, so a calibration is checked straight away.
type Row = {
  name: string;
  found: boolean;
  cornerError?: number;
  correct: number;
  cells: number;
  ms: number;
};
const rows: Row[] = [];
const confusion = new Map<string, Map<string, number>>();
let errors = 0;
let flaggedErrors = 0;
let flaggedCorrect = 0;
for (const item of items) {
  const start = performance.now();
  const reading = await game.read(item.image, { orientation: item.orientation });
  const ms = performance.now() - start;
  let correct = 0;
  for (const cell of reading.cells) {
    const truth = item.truth[cell.key] ?? '(none)';
    const flagged = cell.confidence < LOW_CONFIDENCE;
    const row = confusion.get(truth) ?? new Map<string, number>();
    row.set(cell.label, (row.get(cell.label) ?? 0) + 1);
    confusion.set(truth, row);
    if (cell.label === truth) {
      correct++;
      if (flagged) flaggedCorrect++;
    } else {
      errors++;
      if (flagged) flaggedErrors++;
    }
  }
  rows.push({
    name: item.name,
    found: reading.boardFound,
    ...(item.corners ? { cornerError: cornerError(reading.corners, item.corners) } : {}),
    correct,
    cells: reading.cells.length,
    ms,
  });
}

const totalCells = rows.reduce((sum, r) => sum + r.cells, 0);
const totalCorrect = rows.reduce((sum, r) => sum + r.correct, 0);
const accuracy = totalCells ? totalCorrect / totalCells : 0;
const foundRate = rows.filter((r) => r.found).length / rows.length;
const cornerErrors = rows.flatMap((r) => (r.cornerError === undefined ? [] : [r.cornerError]));
const times = rows.map((r) => r.ms).sort((a, b) => a - b);
const classes = [
  ...new Set([...confusion.keys(), ...[...confusion.values()].flatMap((m) => [...m.keys()])]),
].sort();
const pct = (value: number) => `${(value * 100).toFixed(1)}%`;
const passed = accuracy >= fixtures.accuracyThreshold;

const report = [
  `# Eval report: ${gameId}`,
  '',
  `Generated by \`pnpm eval:cv ${gameId}\` on ${new Date().toISOString().slice(0, 10)}. ${passed ? 'Passed' : 'Failed'}: cell accuracy ${pct(accuracy)} against a threshold of ${pct(fixtures.accuracyThreshold)}.`,
  '',
  '| Metric | Value |',
  '|---|---|',
  `| Photos | ${rows.length} |`,
  `| Board found | ${pct(foundRate)} |`,
  ...(cornerErrors.length
    ? [
        `| Corner error, mean (share of board size) | ${pct(mean(cornerErrors))} |`,
        `| Corner error, worst | ${pct(Math.max(...cornerErrors))} |`,
      ]
    : []),
  `| Cell accuracy | ${pct(accuracy)} (${totalCorrect} of ${totalCells}) |`,
  `| Errors flagged low-confidence (< ${LOW_CONFIDENCE}) | ${errors ? `${pct(flaggedErrors / errors)} (${flaggedErrors} of ${errors})` : 'no errors'} |`,
  `| Correct cells flagged low-confidence | ${pct(totalCorrect ? flaggedCorrect / totalCorrect : 0)} |`,
  `| Time per photo, median | ${median(times).toFixed(0)} ms |`,
  `| Time per photo, slowest | ${Math.max(...times).toFixed(0)} ms |`,
  '',
  '## Confusion matrix',
  '',
  'Rows are the true class, columns the detected class.',
  '',
  `| True \\ Detected | ${classes.join(' | ')} |`,
  `|---|${classes.map(() => '---').join('|')}|`,
  ...classes.map(
    (truth) =>
      `| ${truth} | ${classes.map((c) => confusion.get(truth)?.get(c) ?? 0).join(' | ')} |`,
  ),
  '',
  '## Photos',
  '',
  '| Photo | Board found | Corner error | Cells correct | Time |',
  '|---|---|---|---|---|',
  ...rows.map(
    (r) =>
      `| ${r.name} | ${r.found ? 'yes' : 'no'} | ${r.cornerError === undefined ? '' : pct(r.cornerError)} | ${r.correct} of ${r.cells} | ${r.ms.toFixed(0)} ms |`,
  ),
  '',
].join('\n');

writeFileSync(join(fixturesDir, 'eval-report.md'), report);
console.log(report);
console.log(`Wrote data/fixtures/${gameId}/eval-report.md.`);
if (!passed) process.exit(1);

async function loadGame(file: string): Promise<CvGame> {
  const mod: unknown = await import(pathToFileURL(file).href);
  const game: unknown =
    typeof mod === 'object' && mod !== null ? Reflect.get(mod, 'cvGame') : undefined;
  const members = [
    'detector',
    'labelSchema',
    'cellTruth',
    'read',
    'measure',
    'features',
    'withProfile',
  ];
  if (typeof game !== 'object' || game === null || members.some((m) => !(m in game))) {
    fail(`${file} must export cvGame (CvGame in packages/cv/src/pipeline/game.ts).`);
  }
  return game as CvGame;
}

function decode(bytes: Buffer): ImageInput {
  const raw = jpeg.decode(bytes, { useTArray: true, formatAsRGBA: true, maxMemoryUsageInMB: 1024 });
  return {
    data: new Uint8ClampedArray(raw.data.buffer, raw.data.byteOffset, raw.data.length),
    width: raw.width,
    height: raw.height,
  };
}

function toQuad(corners: [number, number][]): Quad {
  const p = (i: number): Point => {
    const [x, y] = corners[i] as [number, number];
    return { x, y };
  };
  return [p(0), p(1), p(2), p(3)];
}

function mean(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / Math.max(1, values.length);
}

function median(sorted: number[]): number {
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}
