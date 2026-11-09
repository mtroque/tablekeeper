import { fileURLToPath } from 'node:url';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

// The CV worker must not reach React or the DOM (docs/ARCHITECTURE.md → Computer vision). When it
// imported the game UI registry, Turbopack's production build hung and the webpack build's worker
// crashed on `document`, while `next dev` looked fine. This walks the module graph the bundler
// sees, with TypeScript's resolution of the web tsconfig.

const WEB = fileURLToPath(new URL('../../', import.meta.url));
const SRC = `${WEB}src/`;
const WORKER = `${SRC}workers/cv.worker.ts`;

/** UI files and packages the worker graph must never contain. */
const FORBIDDEN_FILES = [`${SRC}games/registry.ts`, `${SRC}lib/cv-client.ts`];
const FORBIDDEN_PACKAGES = ['react', 'react-dom', 'next'];

const config = ts.readConfigFile(`${WEB}tsconfig.json`, (path) => ts.sys.readFile(path));
const { options } = ts.parseJsonConfigFileContent(config.config, ts.sys, WEB);

/** Module specifiers a bundler follows: value imports and re-exports, and dynamic `import()`. */
function specifiers(file: string): string[] {
  const source = ts.createSourceFile(file, ts.sys.readFile(file) ?? '', ts.ScriptTarget.Latest);
  const found: string[] = [];
  const visit = (node: ts.Node) => {
    if (
      ts.isImportDeclaration(node) &&
      node.importClause?.phaseModifier !== ts.SyntaxKind.TypeKeyword
    ) {
      if (ts.isStringLiteral(node.moduleSpecifier)) found.push(node.moduleSpecifier.text);
    } else if (ts.isExportDeclaration(node) && !node.isTypeOnly && node.moduleSpecifier) {
      if (ts.isStringLiteral(node.moduleSpecifier)) found.push(node.moduleSpecifier.text);
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments[0] &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      found.push(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

function packageName(specifier: string): string {
  const parts = specifier.split('/');
  return (specifier.startsWith('@') ? parts.slice(0, 2) : parts.slice(0, 1)).join('/');
}

/** Every import chain from `entry` that reaches a forbidden file, `.tsx` file or package. */
function forbiddenChains(entry: string): string[] {
  const parent = new Map<string, string | null>([[entry, null]]);
  const chain = (file: string, last?: string) => {
    const names: string[] = last ? [last] : [];
    for (let at: string | null | undefined = file; at; at = parent.get(at)) {
      names.unshift(at.replace(WEB, '').replace(/^.*\/packages\//, 'packages/'));
    }
    return names.join(' → ');
  };
  const found: string[] = [];
  const queue = [entry];
  for (let file = queue.shift(); file; file = queue.shift()) {
    if (file !== entry && (FORBIDDEN_FILES.includes(file) || file.endsWith('.tsx'))) {
      found.push(chain(file));
    }
    for (const specifier of specifiers(file)) {
      const resolved = ts.resolveModuleName(specifier, file, options, ts.sys).resolvedModule;
      if (!resolved || resolved.isExternalLibraryImport) {
        if (FORBIDDEN_PACKAGES.includes(packageName(specifier))) found.push(chain(file, specifier));
        continue;
      }
      const next = resolved.resolvedFileName;
      if (parent.has(next) || next.endsWith('.d.ts') || next.endsWith('.json')) continue;
      parent.set(next, file);
      queue.push(next);
    }
  }
  return found;
}

describe('CV worker imports', () => {
  it('reach no UI, React or cv-client', () => {
    expect(forbiddenChains(WORKER)).toEqual([]);
  });

  it('would be caught through the game UI registry (control)', () => {
    const chains = forbiddenChains(`${SRC}games/registry.ts`);
    expect(chains.some((chain) => chain.endsWith('src/lib/cv-client.ts'))).toBe(true);
    expect(chains.some((chain) => chain.endsWith('→ react'))).toBe(true);
  });
});
