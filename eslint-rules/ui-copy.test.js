import { RuleTester } from 'eslint';
import { describe, it } from 'vitest';

import { uiCopy } from './ui-copy.js';

RuleTester.describe = describe;
RuleTester.it = it;

const tester = new RuleTester({
  languageOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
});

tester.run('ui-copy', uiCopy, {
  valid: [
    "const label = 'Save Game';",
    "const range = '2 to 4 players';",
    'const note = `${count} spaces to check.`;',
    'const el = <p>Couldn&apos;t reach the server. Try again.</p>;',
    "const legal = 'Patchwork © Lookout Games';",
    "const kebab = 'well-known';",
    "import x from 'some-module';",
  ],
  invalid: [
    { code: "const s = 'Rules — from the book';", errors: [{ messageId: 'dash' }] },
    { code: "const s = 'Pages 4–5';", errors: [{ messageId: 'dash' }] },
    { code: 'const el = <h1>Your Games — all of them</h1>;', errors: [{ messageId: 'dash' }] },
    { code: 'const s = `Score: ${n} — nice`;', errors: [{ messageId: 'dash' }] },
    { code: "const s = 'Your Games \u{1f3b2}';", errors: [{ messageId: 'emoji' }] },
    { code: "const s = 'Take Photo ✨';", errors: [{ messageId: 'emoji' }] },
    { code: 'const el = <span>Done ✅</span>;', errors: [{ messageId: 'emoji' }] },
    { code: "const s = 'Oops! Something went wrong.';", errors: [{ messageId: 'banned' }] },
    { code: "const s = 'A seamless experience';", errors: [{ messageId: 'banned' }] },
    { code: "const s = 'Let’s get started';", errors: [{ messageId: 'banned' }] },
    { code: 'const el = <p>Dive in to scoring</p>;', errors: [{ messageId: 'banned' }] },
  ],
});
