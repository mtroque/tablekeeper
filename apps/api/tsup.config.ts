import { defineConfig } from 'tsup';

// Bundles the workspace packages (shipped as TypeScript source) into one server file;
// everything from npm stays external.
export default defineConfig({
  entry: ['src/server.ts'],
  format: 'esm',
  platform: 'node',
  target: 'node22',
  noExternal: [/^@tablekeeper\//],
  clean: true,
});
