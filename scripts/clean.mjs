// `pnpm clean`: remove build caches so the next check starts fresh. With paths (relative to the
// repo root), removes only those; apps/web's typecheck uses this for Next's dev route types.
// Node instead of `rm` so it runs the same everywhere and needs no shell permission.
import { readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

import { ROOT } from './lib/local-env.mjs';

const CACHES = ['.next', 'dist', '.turbo', 'tsconfig.tsbuildinfo'];

function defaultTargets() {
  const packages = ['apps', 'packages'].flatMap((dir) =>
    readdirSync(join(ROOT, dir), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => join(dir, entry.name)),
  );
  return ['node_modules/.vite', ...packages.flatMap((dir) => CACHES.map((c) => join(dir, c)))];
}

const targets = process.argv.length > 2 ? process.argv.slice(2) : defaultTargets();
for (const target of targets) rmSync(join(ROOT, target), { recursive: true, force: true });
