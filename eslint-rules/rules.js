// Prose rules enforced in ESLint (docs/AUTOMATION.md → Enforcement map, W2).
// Every error message names what to do instead in one line and links the doc section.

const RAW_COLOR = /#[0-9a-fA-F]{3,8}\b|(?<![a-zA-Z0-9])(?:rgba?|hsla?)\s*\(/i;
const GAME_IDS = new Set(['patchwork', 'azul', 'harmonies', 'dorfromantik', '_example']);
const EQUALITY_OPS = new Set(['===', '!==', '==', '!=']);
const DISABLE_DIRECTIVE = /^\s*eslint-disable(?:-next-line|-line)?\b(.*)$/s;

/** @type {import('eslint').Rule.RuleModule} */
export const noEnvOutsideConfig = {
  meta: {
    type: 'problem',
    docs: { description: 'Disallow reading process.env outside config modules' },
    schema: [],
    messages: {
      env: 'Read environment variables through apps/api/src/config.ts or apps/web/src/lib/env.ts instead of process.env (docs/CONVENTIONS.md → API).',
    },
  },
  create(context) {
    return {
      MemberExpression(node) {
        if (
          !node.computed &&
          node.object.type === 'Identifier' &&
          node.object.name === 'process' &&
          node.property.type === 'Identifier' &&
          node.property.name === 'env'
        ) {
          context.report({ node, messageId: 'env' });
        }
      },
    };
  },
};

/** @type {import('eslint').Rule.RuleModule} */
export const noRawColors = {
  meta: {
    type: 'problem',
    docs: { description: 'Disallow raw hex, rgb(), and hsl() colors outside tokens and games' },
    schema: [],
    messages: {
      color:
        'Use a design token from apps/web/src/app/globals.css or apps/web/src/lib/tokens.ts instead of a raw color literal (docs/CONVENTIONS.md → Web).',
    },
  },
  create(context) {
    const check = (node, text) => {
      if (RAW_COLOR.test(text)) context.report({ node, messageId: 'color' });
    };
    return {
      Literal(node) {
        if (typeof node.value === 'string') check(node, node.value);
      },
      TemplateElement(node) {
        check(node, node.value.cooked ?? node.value.raw);
      },
    };
  },
};

function isGameIdLiteral(node) {
  return node?.type === 'Literal' && typeof node.value === 'string' && GAME_IDS.has(node.value);
}

/** @type {import('eslint').Rule.RuleModule} */
export const noGameIdBranching = {
  meta: {
    type: 'problem',
    docs: { description: 'Disallow comparing against game-id literals in shared code' },
    schema: [],
    messages: {
      branch:
        'Put game-specific behavior in that game module or GameDefinition.features instead of branching on "{{id}}" in shared code (docs/ARCHITECTURE.md → Game modules).',
    },
  },
  create(context) {
    return {
      BinaryExpression(node) {
        if (!EQUALITY_OPS.has(node.operator)) return;
        const match = isGameIdLiteral(node.left)
          ? node.left
          : isGameIdLiteral(node.right)
            ? node.right
            : undefined;
        if (match) context.report({ node: match, messageId: 'branch', data: { id: match.value } });
      },
      SwitchCase(node) {
        if (isGameIdLiteral(node.test)) {
          context.report({ node: node.test, messageId: 'branch', data: { id: node.test.value } });
        }
      },
    };
  },
};

/** @type {import('eslint').Rule.RuleModule} */
export const requireDisableReason = {
  meta: {
    type: 'problem',
    docs: { description: 'Require a "-- reason" on every eslint-disable directive' },
    schema: [],
    messages: {
      reason:
        'Add "-- <reason>" to this eslint-disable comment explaining why the rule is disabled (docs/CONVENTIONS.md → Tooling).',
    },
  },
  create(context) {
    return {
      Program() {
        for (const comment of context.sourceCode.getAllComments()) {
          const match = DISABLE_DIRECTIVE.exec(comment.value);
          if (!match) continue;
          const [, rest = ''] = match;
          const parts = rest.split(/\s+--\s+/);
          if (parts.length < 2 || parts.slice(1).join(' ').trim() === '') {
            context.report({ loc: comment.loc, messageId: 'reason' });
          }
        }
      },
    };
  },
};

export default {
  rules: {
    'no-env-outside-config': noEnvOutsideConfig,
    'no-raw-colors': noRawColors,
    'no-game-id-branching': noGameIdBranching,
    'require-disable-reason': requireDisableReason,
  },
};
