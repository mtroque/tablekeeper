// Renders the `_example` fixtures: seeded synthetic photos of the S1 example game's 3×3 board,
// with labels.json, and copies one into the /dev/cv harness. Run: pnpm exec tsx scripts/make-example-fixtures.ts
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import jpeg from 'jpeg-js';

import { renderExampleBoard } from '../packages/cv/src/games/_example/board';
import { loadOpenCvInNode } from '../packages/cv/src/node';
import { renderSyntheticPhoto, seededRandom, TINTS } from '../packages/cv/src/pipeline/synthetic';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'data/fixtures/_example');
const HARNESS = join(ROOT, 'apps/web/public/dev/cv/example-board.jpg');
const COUNT = 24;
const TABLES: Array<[string, [number, number, number]]> = [
  ['wood', [196, 160, 120]],
  ['white', [235, 233, 228]],
  ['gray', [120, 120, 125]],
  ['pink', [220, 172, 180]],
  ['green', [96, 128, 100]],
];
const TINT_NAMES = ['neutral', 'warm', 'cool'] as const;

await loadOpenCvInNode();
rmSync(join(OUT, 'images'), { recursive: true, force: true });
mkdirSync(join(OUT, 'images'), { recursive: true });
mkdirSync(dirname(HARNESS), { recursive: true });

const items = [];
for (let i = 1; i <= COUNT; i++) {
  const random = seededRandom(1000 + i);
  const cells = [0, 1, 2].map(() => [0, 1, 2].map(() => random() < 0.5));
  const [tableName, table] = TABLES[i % TABLES.length] as [string, [number, number, number]];
  const tint = TINT_NAMES[i % TINT_NAMES.length] as (typeof TINT_NAMES)[number];
  const dark = i % 4 === 0;
  const board = renderExampleBoard(cells, i);
  const { image, corners } = renderSyntheticPhoto(board, {
    seed: i,
    width: 960,
    height: 720,
    boardShare: 0.45 + random() * 0.3,
    rotation: (random() - 0.5) * 60,
    skew: random() * 0.18,
    tint: TINTS[tint],
    brightness: dark ? 0.45 + random() * 0.15 : 0.85 + random() * 0.25,
    noise: 3 + random() * 7,
    table,
  });
  board.delete();
  const name = `images/${String(i).padStart(2, '0')}-${tableName}-${tint}${dark ? '-dark' : ''}.jpg`;
  const file = jpeg.encode({ data: image.data, width: image.width, height: image.height }, 88);
  writeFileSync(join(OUT, name), file.data);
  if (i === 1) writeFileSync(HARNESS, file.data);
  items.push({
    image: name,
    corners: corners.map((p) => [round(p.x), round(p.y)]),
    label: { grid: cells.map((row) => row.map((covered) => (covered ? '#' : '.')).join('')) },
  });
}

const labels = { gameId: '_example', accuracyThreshold: 0.98, items };
writeFileSync(join(OUT, 'labels.json'), `${JSON.stringify(labels, null, 2)}\n`);
console.log(`Wrote ${COUNT} synthetic photos and labels.json to data/fixtures/_example.`);

function round(value: number): number {
  return Math.round(value * 10) / 10;
}
