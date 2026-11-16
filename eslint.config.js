import nextPlugin from '@next/eslint-plugin-next';
import prettier from 'eslint-config-prettier';
import { importX } from 'eslint-plugin-import-x';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

import rules from './eslint-rules/rules.js';
import copy from './eslint-rules/ui-copy.js';

const TS = ['**/*.{ts,tsx,mts,cts}'];
const SRC = ['apps/*/src/**/*.{ts,tsx,js,jsx}', 'packages/*/src/**/*.{ts,tsx,js,jsx}'];
const TESTS = ['**/*.test.{ts,tsx,js}', '**/test/**', '**/tests/**'];

const PURE_SCORER_MESSAGE =
  'Scorers and game definitions in packages/core must stay pure and deterministic (AGENTS.md → Hard rules).';

/** Package boundaries (docs/ARCHITECTURE.md → Monorepo), by package name and by relative path. */
function boundary(files, banned, typeOnly = [], extraPatterns = []) {
  return {
    files: files.map((glob) => `${glob}/*.{ts,tsx}`),
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            ...banned.map((name) => ({ name, allowTypeImports: false })),
            ...typeOnly.map((name) => ({ name, allowTypeImports: true })),
          ]
            .map(({ name, allowTypeImports }) => ({
              group: [name, `${name}/*`],
              message: allowTypeImports
                ? 'Only type imports cross this boundary (docs/ARCHITECTURE.md → Monorepo).'
                : 'Crosses a package boundary (docs/ARCHITECTURE.md → Monorepo).',
              allowTypeImports,
            }))
            .concat(extraPatterns),
        },
      ],
    },
  };
}

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.vercel/**',
      '**/.next/**',
      '**/coverage/**',
      'playwright-report/**',
      'test-results/**',
      'apps/web/next-env.d.ts',
      '.claude/**',
    ],
  },
  {
    linterOptions: { reportUnusedDisableDirectives: 'error' },
  },
  {
    files: ['**/*.{js,mjs,cjs,ts,tsx}'],
    plugins: { 'import-x': importX, rules },
    languageOptions: { globals: { ...globals.node } },
    rules: {
      'rules/require-disable-reason': 'error',
      'import-x/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
          pathGroups: [{ pattern: '@/**', group: 'internal' }],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],
      'import-x/no-duplicates': 'error',
      // Relative imports that escape a package (the name-based check is below).
      'import-x/no-restricted-paths': [
        'error',
        {
          zones: [
            { target: './packages/core', from: ['./apps', './packages/cv'] },
            { target: './packages/cv', from: './apps' },
            { target: './apps/api', from: ['./apps/web', './packages/cv'] },
            { target: './apps/web', from: './apps/api' },
          ],
        },
      ],
    },
  },
  ...tseslint.configs.strictTypeChecked.map((config) => ({ ...config, files: TS })),
  {
    files: TS,
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/consistent-type-definitions': 'off',
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // Express 5 forwards rejected promises from async handlers to the error middleware.
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: { arguments: false } },
      ],
    },
  },
  {
    files: TESTS,
    rules: { '@typescript-eslint/no-non-null-assertion': 'off' },
  },
  boundary(
    ['packages/core/**'],
    ['@tablekeeper/web', '@tablekeeper/api', '@tablekeeper/cv'],
    [],
    [
      {
        group: ['@anthropic-ai/sdk', '@anthropic-ai/sdk/*'],
        message:
          'Call the LLM through apps/api/src/llm/gateway.ts instead of importing @anthropic-ai/sdk directly (AGENTS.md → Hard rules).',
      },
    ],
  ),
  boundary(
    ['packages/cv/**'],
    ['@tablekeeper/web', '@tablekeeper/api'],
    ['@tablekeeper/core'],
    [
      {
        group: ['@anthropic-ai/sdk', '@anthropic-ai/sdk/*'],
        message:
          'Call the LLM through apps/api/src/llm/gateway.ts instead of importing @anthropic-ai/sdk directly (AGENTS.md → Hard rules).',
      },
    ],
  ),
  boundary(
    ['apps/api/**'],
    ['@tablekeeper/web', '@tablekeeper/cv'],
    [],
    [
      {
        group: ['@anthropic-ai/sdk', '@anthropic-ai/sdk/*'],
        message:
          'Call the LLM through apps/api/src/llm/gateway.ts instead of importing @anthropic-ai/sdk directly (AGENTS.md → Hard rules).',
      },
    ],
  ),
  boundary(['apps/api/src/llm/**'], ['@tablekeeper/web', '@tablekeeper/cv']),
  boundary(
    ['apps/web/**'],
    ['@tablekeeper/api'],
    [],
    [
      {
        group: ['@anthropic-ai/sdk', '@anthropic-ai/sdk/*'],
        message:
          'Call the LLM through apps/api/src/llm/gateway.ts instead of importing @anthropic-ai/sdk directly (AGENTS.md → Hard rules).',
      },
    ],
  ),
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks, '@next/next': nextPlugin },
    languageOptions: { globals: { ...globals.browser } },
    settings: { next: { rootDir: 'apps/web' } },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
    },
  },
  {
    files: SRC,
    ignores: TESTS,
    plugins: { copy, rules },
    rules: { 'copy/ui-copy': 'error' },
  },
  {
    files: SRC,
    ignores: [...TESTS, 'apps/api/src/config.ts', 'apps/web/src/lib/env.ts'],
    plugins: { rules },
    rules: { 'rules/no-env-outside-config': 'error' },
  },
  {
    files: ['packages/core/src/games/**/*.{ts,tsx}'],
    ignores: TESTS,
    rules: {
      'no-restricted-globals': [
        'error',
        ...[
          'Date',
          'fetch',
          'process',
          'console',
          'setTimeout',
          'setInterval',
          'clearTimeout',
          'clearInterval',
          'queueMicrotask',
          'requestAnimationFrame',
        ].map((name) => ({ name, message: PURE_SCORER_MESSAGE })),
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: PURE_SCORER_MESSAGE },
      ],
    },
  },
  {
    files: ['apps/web/src/{components,app,games}/**/*.{ts,tsx}'],
    ignores: TESTS,
    rules: {
      'no-restricted-globals': [
        'error',
        {
          name: 'fetch',
          message:
            'Call the API through apps/web/src/lib/api-client.ts or load assets in apps/web/src/lib/ instead of calling fetch directly (docs/CONVENTIONS.md → Web).',
        },
      ],
      'no-restricted-properties': [
        'error',
        {
          object: 'window',
          property: 'fetch',
          message:
            'Call the API through apps/web/src/lib/api-client.ts or load assets in apps/web/src/lib/ instead of calling fetch directly (docs/CONVENTIONS.md → Web).',
        },
        {
          object: 'globalThis',
          property: 'fetch',
          message:
            'Call the API through apps/web/src/lib/api-client.ts or load assets in apps/web/src/lib/ instead of calling fetch directly (docs/CONVENTIONS.md → Web).',
        },
      ],
    },
  },
  {
    files: ['apps/web/src/**/*.{ts,tsx}'],
    ignores: [...TESTS, 'apps/web/src/lib/tokens.ts', 'apps/web/src/games/**'],
    plugins: { rules },
    rules: { 'rules/no-raw-colors': 'error' },
  },
  {
    files: SRC,
    ignores: [
      ...TESTS,
      '**/games/**',
      'packages/core/src/kit/types.ts',
      'packages/core/src/contracts/games.ts',
    ],
    plugins: { rules },
    rules: { 'rules/no-game-id-branching': 'error' },
  },
  prettier,
);
