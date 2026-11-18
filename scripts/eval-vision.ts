// pnpm eval:cv <gameId> [--calibrate] [--record]
// pnpm eval:cv --check
// Runs a game's detector on data/fixtures/<gameId> and reports board-found rate, corner error,
// per-cell accuracy, the confusion matrix, how many errors were flagged low-confidence, and timing
// (docs/ARCHITECTURE.md → Computer vision). Writes data/fixtures/<gameId>/eval-report.md and exits 1
// below the fixture set's accuracy threshold. --calibrate rebuilds games/<gameId>/profile.json, or
// runs the game's own `calibrate` when it has one (scripts/lib/game-calibration.ts). --record
// writes data/fixtures/<gameId>/baseline.json; --check gates every detector game against it.
import { execSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import prettier from 'prettier';

import type { Point, Quad } from '../packages/core/src';
import {
  calibrateProfile,
  cornerError,
  LOW_CONFIDENCE,
  readExifOrientation,
} from '../packages/cv/src';
import type { CvGame } from '../packages/cv/src';
import { loadOpenCvInNode } from '../packages/cv/src/node';
import { FixtureSetSchema } from '../packages/cv/src/pipeline/fixtures';

import {
  compareCvBaseline,
  CvBaselineSchema,
  formatBaselineTable,
  partitionBaselineGames,
  type CvBaseline,
  type CvMetrics,
} from './lib/cv-baseline';
import { decodeJpeg, runGameCalibration } from './lib/game-calibration';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const args = process.argv.slice(2);
const checkMode = args.includes('--check');
const recordMode = args.includes('--record');
const calibrate = args.includes('--calibrate');
const gameId = args.find((arg) => !arg.startsWith('--'));

if (checkMode) {
  await runCheckMode();
} else {
  if (!gameId || !/^_?[a-z][a-z0-9-]*$/.test(gameId)) {
    console.error('Usage: pnpm eval:cv <gameId> [--calibrate] [--record] | pnpm eval:cv --check');
    process.exit(2);
  }
  await runSingleGame(gameId, { calibrate, record: recordMode });
}

async function runCheckMode(): Promise<void> {
  const cvGamesDir = join(ROOT, 'packages/cv/src/games');
  const fixturesRoot = join(ROOT, 'data/fixtures');
  const detectorGames = readdirSync(cvGamesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter(
      (id) =>
        existsSync(join(cvGamesDir, id, 'index.ts')) &&
        existsSync(join(fixturesRoot, id, 'labels.json')),
    )
    .sort();
  const gamesWithBaseline = readdirSync(fixturesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((id) => existsSync(join(fixturesRoot, id, 'baseline.json')));

  const { ready, missingBaseline } = partitionBaselineGames(detectorGames, gamesWithBaseline);
  if (missingBaseline.length > 0) {
    for (const id of missingBaseline) {
      console.error(`Missing CV baseline for ${id}. Record one with: pnpm eval:cv ${id} --record`);
    }
    process.exit(1);
  }

  await loadOpenCvInNode();
  let allPassed = true;
  for (const id of ready) {
    const baselinePath = join(fixturesRoot, id, 'baseline.json');
    const baseline = CvBaselineSchema.parse(JSON.parse(readFileSync(baselinePath, 'utf8')));
    const evalResult = await evaluateGame(id, { calibrate: false });
    console.log(formatBaselineTable(id, baseline, evalResult.metrics));
    console.log('');
    const comparison = compareCvBaseline(baseline, evalResult.metrics);
    if (!comparison.passed) {
      allPassed = false;
      for (const failure of comparison.failures) {
        console.error(`${id}: ${failure.reason}`);
      }
    }
  }
  if (!allPassed) process.exit(1);
}

async function runSingleGame(
  id: string,
  opts: { calibrate: boolean; record: boolean },
): Promise<void> {
  await loadOpenCvInNode();
  const { fixturesDir, fixtures, report, accuracy, metrics } = await evaluateGame(id, opts);
  writeFileSync(join(fixturesDir, 'eval-report.md'), report);
  console.log(report);
  console.log(`Wrote data/fixtures/${id}/eval-report.md.`);

  if (opts.record) {
    const commit = execSync('git rev-parse --short HEAD', { cwd: ROOT, encoding: 'utf8' }).trim();
    const baseline: CvBaseline = {
      ...metrics,
      recordedAt: new Date().toISOString(),
      commit,
    };
    const file = join(fixturesDir, 'baseline.json');
    const prettierOpts = (await prettier.resolveConfig(file)) ?? {};
    writeFileSync(
      file,
      await prettier.format(JSON.stringify(baseline), { ...prettierOpts, parser: 'json' }),
    );
    console.log(`Wrote data/fixtures/${id}/baseline.json.`);
    return;
  }

  if (accuracy < fixtures.accuracyThreshold) process.exit(1);
}

async function evaluateGame(id: string, opts: { calibrate: boolean }) {
  const fixturesDir = join(ROOT, 'data/fixtures', id);
  const gameDir = join(ROOT, 'packages/cv/src/games', id);
  if (!existsSync(join(fixturesDir, 'labels.json')))
    fail(`No fixtures at data/fixtures/${id}/labels.json.`);
  if (!existsSync(join(gameDir, 'index.ts')))
    fail(`No detector at packages/cv/src/games/${id}/index.ts.`);

  const fixtures = FixtureSetSchema.parse(
    JSON.parse(readFileSync(join(fixturesDir, 'labels.json'), 'utf8')),
  );
  let game = await loadGame(join(gameDir, 'index.ts'));

  const items = fixtures.items.map((item) => {
    const bytes = readFileSync(join(fixturesDir, item.image));
    const label = game.labelSchema.parse(item.label);
    return {
      name: item.image,
      image: decodeJpeg(bytes),
      orientation: readExifOrientation(bytes),
      ...(item.corners ? { corners: toQuad(item.corners) } : {}),
      label,
      truth: game.cellTruth(label),
    };
  });

  if (opts.calibrate && game.calibrate) {
    const calibrated = await runGameCalibration({
      game,
      fixturesDir,
      gameDir,
      items,
    });
    game = calibrated.game;
    for (const line of calibrated.summary) console.log(line);
    for (const name of calibrated.written) {
      console.log(`Wrote packages/cv/src/games/${id}/${name}.`);
    }
  } else if (opts.calibrate) {
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
    console.log(`Wrote packages/cv/src/games/${id}/profile.json (tolerance ${profile.tolerance}).`);
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
  const foundRate = rows.length ? rows.filter((r) => r.found).length / rows.length : 0;
  const cornerErrors = rows.flatMap((r) => (r.cornerError === undefined ? [] : [r.cornerError]));
  const meanCornerError = cornerErrors.length ? mean(cornerErrors) : null;
  const flaggedErrorRate = errors ? flaggedErrors / errors : null;
  const classes = [
    ...new Set([...confusion.keys(), ...[...confusion.values()].flatMap((m) => [...m.keys()])]),
  ].sort();
  const times = rows.map((r) => r.ms).sort((a, b) => a - b);
  const pct = (value: number) => `${(value * 100).toFixed(1)}%`;
  const passed = accuracy >= fixtures.accuracyThreshold;

  const report = [
    `# Eval report: ${id}`,
    '',
    `Generated by \`pnpm eval:cv ${id}\` on ${new Date().toISOString().slice(0, 10)}. ${passed ? 'Passed' : 'Failed'}: cell accuracy ${pct(accuracy)} against a threshold of ${pct(fixtures.accuracyThreshold)}.`,
    '',
    '| Metric | Value |',
    '|---|---|',
    `| Photos | ${rows.length} |`,
    `| Board found | ${pct(foundRate)} |`,
    ...(meanCornerError !== null
      ? [
          `| Corner error, mean (share of board size) | ${pct(meanCornerError)} |`,
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

  const metrics: CvMetrics = {
    cellAccuracy: accuracy,
    boardFoundRate: foundRate,
    flaggedErrorRate,
    meanCornerError,
  };

  return { fixturesDir, fixtures, report, accuracy, metrics };
}

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
