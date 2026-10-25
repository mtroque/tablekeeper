import nextPlugin from '@next/eslint-plugin-next';
import prettier from 'eslint-config-prettier';
import { importX } from 'eslint-plugin-import-x';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

import copy from './eslint-rules/ui-copy.js';

const TS = ['**/*.{ts,tsx,mts,cts}'];
const SRC = ['apps/*/src/**/*.{ts,tsx,js,jsx}', 'packages/*/src/**/*.{ts,tsx,js,jsx}'];
const TESTS = ['**/*.test.{ts,tsx,js}', '**/test/**', '**/tests/**'];

/** Package boundaries (docs/ARCHITECTURE.md → Monorepo), by package name and by relative path. */
function boundary(files, banned, typeOnly = []) {
  return {
    files: files.map((glob) => `${glob}/*.{ts,tsx}`),
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            ...banned.map((name) => ({ name, allowTypeImports: false })),
            ...typeOnly.map((name) => ({ name, allowTypeImports: true })),
          ].map(({ name, allowTypeImports }) => ({
            group: [name, `${name}/*`],
            message: allowTypeImports
              ? 'Only type imports cross this boundary (docs/ARCHITECTURE.md → Monorepo).'
              : 'Crosses a package boundary (docs/ARCHITECTURE.md → Monorepo).',
            allowTypeImports,
          })),
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
      '**/.next/**',
      '**/coverage/**',
      'playwright-report/**',
      'test-results/**',
      'apps/web/next-env.d.ts',
      'apps/api/src/db/database.types.ts',
      '.claude/**',
    ],
  },
  {
    files: ['**/*.{js,mjs,cjs,ts,tsx}'],
    plugins: { 'import-x': importX },
    languageOptions: { globals: { ...globals.node } },
    rules: {
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
  boundary(['packages/core/**'], ['@tablekeeper/web', '@tablekeeper/api', '@tablekeeper/cv']),
  boundary(['packages/cv/**'], ['@tablekeeper/web', '@tablekeeper/api'], ['@tablekeeper/core']),
  boundary(['apps/api/**'], ['@tablekeeper/web', '@tablekeeper/cv']),
  boundary(['apps/web/**'], ['@tablekeeper/api']),
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
    plugins: { copy },
    rules: { 'copy/ui-copy': 'error' },
  },
  prettier,
);
