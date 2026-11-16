import { ESLint, RuleTester } from 'eslint';
import { describe, expect, it } from 'vitest';

import {
  noEnvOutsideConfig,
  noGameIdBranching,
  noRawColors,
  requireDisableReason,
} from './rules.js';

RuleTester.describe = describe;
RuleTester.it = it;

const tester = new RuleTester({
  languageOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
});

tester.run('no-env-outside-config', noEnvOutsideConfig, {
  valid: ['const url = publicEnv().NEXT_PUBLIC_API_URL;', 'const env = config.env;'],
  invalid: [
    {
      code: 'const url = process.env.NEXT_PUBLIC_API_URL;',
      errors: [{ messageId: 'env' }],
    },
    {
      code: 'const copy = { ...process.env };',
      errors: [{ messageId: 'env' }],
    },
  ],
});

tester.run('no-raw-colors', noRawColors, {
  valid: [
    "const cls = 'bg-surface text-ink border-line shadow-float';",
    "const stroke = 'var(--accent)';",
    'const label = `Score #${rank}`;',
  ],
  invalid: [
    { code: "const bg = '#f6f1e9';", errors: [{ messageId: 'color' }] },
    { code: 'const el = <rect fill="#7d2438" />;', errors: [{ messageId: 'color' }] },
    {
      code: "const cls = 'shadow-[0_8px_24px_rgb(0_0_0/0.14)]';",
      errors: [{ messageId: 'color' }],
    },
    { code: 'const c = `hsl(${h} 50% 50%)`;', errors: [{ messageId: 'color' }] },
  ],
});

tester.run('no-game-id-branching', noGameIdBranching, {
  valid: [
    'if (game.features.campaign) showCampaign();',
    "if (status === 'completed') save();",
    "const title = 'patchwork';",
  ],
  invalid: [
    {
      code: "if (gameId === 'patchwork') reread();",
      errors: [{ messageId: 'branch' }],
    },
    {
      code: "if ('harmonies' !== game.id) clear();",
      errors: [{ messageId: 'branch' }],
    },
    {
      code: "switch (id) { case 'dorfromantik': break; }",
      errors: [{ messageId: 'branch' }],
    },
  ],
});

tester.run('require-disable-reason', requireDisableReason, {
  valid: [
    '// eslint-disable-next-line no-console -- CLI output',
    '/* eslint-disable-next-line no-debugger -- user data URL */',
    '// normal comment without directive',
  ],
  invalid: [
    {
      code: '// eslint-disable-next-line no-console\nconsole.log(1);',
      errors: [{ messageId: 'reason' }],
    },
    {
      code: '/* eslint-disable no-debugger --   */',
      errors: [{ messageId: 'reason' }],
    },
  ],
});

describe('eslint.config.js scoped rules', () => {
  const eslint = new ESLint();

  async function messages(code, filePath) {
    const [res] = await eslint.lintText(code, { filePath });
    return res?.messages ?? [];
  }

  it('disallows @anthropic-ai/sdk outside apps/api/src/llm/ and allows it inside', async () => {
    const bad = await messages(
      "import Anthropic from '@anthropic-ai/sdk';\nexport const a = Anthropic;\n",
      'apps/api/src/services/rules.ts',
    );
    expect(bad.some((m) => m.ruleId === '@typescript-eslint/no-restricted-imports')).toBe(true);

    const good = await messages(
      "import Anthropic from '@anthropic-ai/sdk';\nexport const a = Anthropic;\n",
      'apps/api/src/llm/anthropic-provider.ts',
    );
    expect(good.some((m) => m.ruleId === '@typescript-eslint/no-restricted-imports')).toBe(false);
  });

  it('disallows impure globals in packages/core/src/games/ and allows pure code', async () => {
    const bad = await messages(
      'export const now = () => Date.now() + Math.random();\n',
      'packages/core/src/games/patchwork/index.ts',
    );
    expect(bad.some((m) => m.ruleId === 'no-restricted-globals')).toBe(true);
    expect(bad.some((m) => m.ruleId === 'no-restricted-properties')).toBe(true);

    const good = await messages(
      'export const score = (n: number) => Math.max(0, n);\n',
      'packages/core/src/games/patchwork/index.ts',
    );
    expect(
      good.some(
        (m) => m.ruleId === 'no-restricted-globals' || m.ruleId === 'no-restricted-properties',
      ),
    ).toBe(false);
  });

  it('disallows fetch in apps/web/src/{components,app,games}/ and allows it in lib/', async () => {
    const bad = await messages(
      "export const load = () => fetch('/v1/games');\n",
      'apps/web/src/components/game-card.tsx',
    );
    expect(bad.some((m) => m.ruleId === 'no-restricted-globals')).toBe(true);

    const good = await messages(
      "export const load = () => fetch('/v1/games');\n",
      'apps/web/src/lib/api-client.ts',
    );
    expect(good.some((m) => m.ruleId === 'no-restricted-globals')).toBe(false);
  });

  it('reports unused eslint-disable directives as errors', async () => {
    const bad = await messages(
      '// eslint-disable-next-line no-debugger -- not used\nexport const x = 1;\n',
      'packages/core/src/index.ts',
    );
    expect(bad.some((m) => m.message.includes('Unused eslint-disable directive'))).toBe(true);
  });
});
