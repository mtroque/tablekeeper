// Writes the API as one Vercel Function in the Build Output API layout
// (https://vercel.com/docs/build-output-api), so Vercel deploys exactly what this builds:
//   .vercel/output/config.json                 every path → the function
//   .vercel/output/functions/index.func/       src/vercel.ts and all dependencies, one CJS file
// The workspace packages ship TypeScript source (D-019), so everything is bundled; the
// function needs no node_modules. Usage: node scripts/build-vercel.mjs [outputDir]
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { build } from 'tsup';

const API_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT = resolve(process.argv[2] ?? join(API_ROOT, '.vercel/output'));
const FUNC = join(OUTPUT, 'functions/index.func');

await rm(OUTPUT, { recursive: true, force: true });
await build({
  config: false,
  entry: { app: join(API_ROOT, 'src/vercel.ts') },
  outDir: FUNC,
  format: 'cjs',
  platform: 'node',
  target: 'node22',
  noExternal: [/.*/],
  splitting: false,
  silent: true,
});

const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
await mkdir(FUNC, { recursive: true });
// The bundle's default export is the Express app; the launcher gets it as module.exports.
await writeFile(join(FUNC, 'index.cjs'), "module.exports = require('./app.cjs').default;\n");
await writeFile(
  join(FUNC, '.vc-config.json'),
  json({
    runtime: 'nodejs22.x',
    handler: 'index.cjs',
    launcherType: 'Nodejs',
    shouldAddHelpers: false,
    // A rules question stops at 30s (RULES_TIMEOUT_MS); Hobby allows up to 300s.
    maxDuration: 60,
  }),
);
await writeFile(
  join(OUTPUT, 'config.json'),
  json({ version: 3, routes: [{ src: '/(.*)', dest: '/index' }] }),
);
console.log(`Vercel output written to ${OUTPUT}`);
