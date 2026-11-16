// Conventional Commits (docs/CONVENTIONS.md → Git). Scope is required (except `docs: merge <branch>` commits from the retired `/merge`, kept for old history), and must be a game id or an area.
export function requireScopeExceptMerge({ type, scope, subject }) {
  if (scope) return [true];
  if (type === 'docs' && typeof subject === 'string' && subject.startsWith('merge ')) {
    return [true];
  }
  return [
    false,
    'Add a scope from commitlint.config.js (e.g. docs, web, api, workflow) instead of dropping it (docs/CONVENTIONS.md → Git).',
  ];
}

export default {
  extends: ['@commitlint/config-conventional'],
  plugins: [
    {
      rules: {
        'require-scope-except-merge': requireScopeExceptMerge,
      },
    },
  ],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'refactor',
        'perf',
        'test',
        'docs',
        'build',
        'ci',
        'chore',
        'style',
        'revert',
      ],
    ],
    'scope-enum': [
      2,
      'always',
      [
        'patchwork',
        'azul',
        'harmonies',
        'dorfromantik',
        'core',
        'cv',
        'api',
        'web',
        'db',
        'rules',
        'deps',
        'docs',
        'roadmap',
        'workflow',
      ],
    ],
    'require-scope-except-merge': [2, 'always'],
    'header-max-length': [2, 'always', 72],
    'subject-full-stop': [2, 'never', '.'],
  },
};
