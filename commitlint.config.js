// Conventional Commits (docs/CONVENTIONS.md → Git). Scope is optional, but must be a game id or an area.
export default {
  extends: ['@commitlint/config-conventional'],
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
        'roadmap',
      ],
    ],
    'header-max-length': [2, 'always', 72],
    'subject-full-stop': [2, 'never', '.'],
  },
};
