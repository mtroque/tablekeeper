// Copy lint (docs/UX.md → Look and voice → Words): user-facing strings have no em or en dashes,
// no emoji and none of the banned filler phrases. Checks string literals, template literals and
// JSX text; import paths are skipped.

const DASHES = /[–—]/;
// Pictographs and emoji presentation, minus the text symbols ©, ® and ™.
const EMOJI = /(?![©®™])[\p{Extended_Pictographic}\u{1f1e6}-\u{1f1ff}️]/u;

export const BANNED_PHRASES = [
  'seamless',
  'effortless',
  'elevate',
  'unlock the power',
  'dive in',
  "let's get started",
  'oops',
  "you're all set",
  'game-changer',
  'supercharge',
  'in just a few clicks',
];

/** The first problem with a piece of copy, or undefined. */
export function findCopyProblem(text) {
  if (DASHES.test(text)) return { messageId: 'dash' };
  if (EMOJI.test(text)) return { messageId: 'emoji' };
  const normalized = text.toLowerCase().replace(/[‘’]/g, "'");
  const phrase = BANNED_PHRASES.find((p) => normalized.includes(p));
  if (phrase) return { messageId: 'banned', data: { phrase } };
  return undefined;
}

/** @type {import('eslint').Rule.RuleModule} */
export const uiCopy = {
  meta: {
    type: 'problem',
    docs: { description: 'Enforce the UI copy rules in docs/UX.md → Words' },
    schema: [],
    messages: {
      dash: 'No em or en dashes in user-facing text. Use a period, comma, colon or parentheses; ranges use "to".',
      emoji: 'No emoji in the interface.',
      banned: 'Banned filler phrase "{{phrase}}" (docs/UX.md → Words).',
    },
  },
  create(context) {
    const check = (node, text) => {
      const problem = findCopyProblem(text);
      if (problem) context.report({ node, ...problem });
    };
    const isModuleSource = (node) =>
      [
        'ImportDeclaration',
        'ExportNamedDeclaration',
        'ExportAllDeclaration',
        'ImportExpression',
      ].includes(node.parent?.type) && node.parent.source === node;
    return {
      Literal(node) {
        if (typeof node.value === 'string' && !isModuleSource(node)) check(node, node.value);
      },
      TemplateElement(node) {
        check(node, node.value.cooked ?? node.value.raw);
      },
      JSXText(node) {
        check(node, node.value);
      },
    };
  },
};

export default { rules: { 'ui-copy': uiCopy } };
