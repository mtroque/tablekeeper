// pnpm exec tsx scripts/screens-report.ts --dir <shots> --baseline <dir> --raw-base <url>
//   --folder-url <url> --sha <sha> --comment <file> --index <file>
// Writes the Screens workflow's PR comment and the folder README (W10). The baseline is the
// `main` set on the `screens` branch; a missing folder means there is none yet.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

import { SCREENS } from '../tests/e2e/screens';

import { renderComment, renderIndex, type ShotInfo } from './lib/screens-report';

const { values } = parseArgs({
  options: {
    dir: { type: 'string' },
    baseline: { type: 'string' },
    'raw-base': { type: 'string' },
    'folder-url': { type: 'string' },
    sha: { type: 'string' },
    comment: { type: 'string' },
    index: { type: 'string' },
  },
});
const required = ['dir', 'baseline', 'raw-base', 'folder-url', 'sha', 'comment', 'index'] as const;
for (const key of required) {
  if (!values[key]) {
    console.error(`Missing --${key}.`);
    process.exit(2);
  }
}
const arg = (key: (typeof required)[number]): string => values[key] ?? '';

const hashOf = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex');

const shots: ShotInfo[] = [];
const missing: string[] = [];
for (const entry of SCREENS) {
  const file = join(arg('dir'), `${entry.id}.png`);
  if (existsSync(file)) {
    shots.push({ id: entry.id, screen: entry.screen, state: entry.state, hash: hashOf(file) });
  } else {
    missing.push(entry.id);
  }
}

const baselineDir = arg('baseline');
const baseline = existsSync(baselineDir)
  ? new Map(
      SCREENS.flatMap((entry) => {
        const file = join(baselineDir, `${entry.id}.png`);
        return existsSync(file) ? [[entry.id, hashOf(file)] as const] : [];
      }),
    )
  : null;

writeFileSync(
  arg('comment'),
  renderComment({
    shots,
    missing,
    baseline,
    rawBase: arg('raw-base'),
    folderUrl: arg('folder-url'),
    sha: arg('sha'),
  }),
);
writeFileSync(arg('index'), renderIndex(shots, arg('sha')));
console.log(`${String(shots.length)} shots, ${String(missing.length)} not reached.`);
