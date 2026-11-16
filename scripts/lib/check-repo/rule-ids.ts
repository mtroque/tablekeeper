import ts from 'typescript';

const RULE_ID_TOKEN = /\b(?:AZU|DOR|HAR|PAT)-[A-Z0-9]+(?:-[A-Z0-9]+)*(?:\.\.[A-Z]*\d+)?\b/g;
const RANGE_CELL = /^((?:AZU|DOR|HAR|PAT)-(?:[A-Z0-9]+-)*[A-Z]+)(\d+)\.\.[A-Z]*(\d+)$/;

/** Expands a markdown table cell or test token such as `DOR-B1..B5` or `DOR-D1, D2` into full rule IDs. */
export function expandIdCell(cell: string): string[] {
  const cleaned = cell.replaceAll('`', '').trim();
  const range = RANGE_CELL.exec(cleaned);
  if (range) {
    const [, prefix = '', startStr = '0', endStr = '0'] = range;
    const start = Number(startStr);
    const end = Number(endStr);
    const ids: string[] = [];
    for (let i = start; i <= end; i++) ids.push(`${prefix}${i}`);
    return ids;
  }

  const parts = cleaned
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  const first = parts[0];
  if (!first || !/^(?:AZU|DOR|HAR|PAT)-/.test(first)) return [];
  const lastDash = first.lastIndexOf('-');
  const prefix = first.slice(0, lastDash + 1);
  return parts.map((part, idx) =>
    idx === 0 || /^(?:AZU|DOR|HAR|PAT)-/.test(part) ? part : `${prefix}${part}`,
  );
}

/** Extracts defined rule IDs (by file) from markdown tables whose first column is `ID`. */
export function extractDefinedRuleIds(docs: Record<string, string>): Map<string, string> {
  const defined = new Map<string, string>();
  for (const [file, content] of Object.entries(docs)) {
    const lines = content.split(/\r?\n/);
    let inIdTable = false;
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('|')) {
        inIdTable = false;
        continue;
      }
      const cells = trimmed
        .split('|')
        .slice(1, -1)
        .map((c) => c.trim());
      if (cells.length < 2) continue;
      const firstCell = cells[0] ?? '';
      if (firstCell === 'ID') {
        inIdTable = true;
        continue;
      }
      if (/^[-:]+$/.test(firstCell)) continue;
      if (!inIdTable) continue;
      // Rules marked ⚠️ or VERIFY are exempt until verified (AGENTS.md → Workflow).
      if (line.includes('⚠️') || /\bVERIFY\b/.test(line)) continue;
      for (const id of expandIdCell(firstCell)) {
        defined.set(id, file);
      }
    }
  }
  return defined;
}

function stringTexts(node: ts.Node): string[] {
  const out: string[] = [];
  const visit = (n: ts.Node) => {
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) {
      out.push(n.text);
    } else if (ts.isTemplateExpression(n)) {
      out.push(n.head.text, ...n.templateSpans.map((s) => s.literal.text));
    }
    ts.forEachChild(n, visit);
  };
  visit(node);
  return out;
}

/** Extracts rule IDs cited in `it`, `test`, or `describe` titles (including `.each` tables). */
export function extractCitedRuleIds(testFiles: Record<string, string>): Map<string, Set<string>> {
  const cited = new Map<string, Set<string>>();
  const record = (id: string, file: string) => {
    let files = cited.get(id);
    if (!files) {
      files = new Set();
      cited.set(id, files);
    }
    files.add(file);
  };

  for (const [file, content] of Object.entries(testFiles)) {
    const source = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true);
    const visit = (node: ts.Node) => {
      if (ts.isCallExpression(node)) {
        const expr = node.expression;
        // Direct call: it('...', fn), test('...', fn), describe('...', fn), it.skipIf(...)('...', fn)
        const isTestCall =
          (ts.isIdentifier(expr) && ['it', 'test', 'describe'].includes(expr.text)) ||
          (ts.isPropertyAccessExpression(expr) &&
            ts.isIdentifier(expr.expression) &&
            ['it', 'test', 'describe'].includes(expr.expression.text)) ||
          (ts.isCallExpression(expr) &&
            ts.isPropertyAccessExpression(expr.expression) &&
            ts.isIdentifier(expr.expression.expression) &&
            ['it', 'test', 'describe'].includes(expr.expression.expression.text));

        if (isTestCall) {
          const texts: string[] = [];
          const firstArg = node.arguments[0];
          if (firstArg) texts.push(...stringTexts(firstArg));
          // Also include `.each([...])('title', ...)` table strings when the title formats `%s`.
          if (
            ts.isCallExpression(expr) &&
            ts.isPropertyAccessExpression(expr.expression) &&
            expr.expression.name.text === 'each' &&
            expr.arguments[0]
          ) {
            texts.push(...stringTexts(expr.arguments[0]));
          }
          for (const text of texts) {
            for (const match of text.matchAll(RULE_ID_TOKEN)) {
              for (const id of expandIdCell(match[0])) {
                record(id, file);
              }
            }
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return cited;
}

/** Checks that every defined rule ID is cited in a test title and every cited ID is defined. */
export function checkRuleIds(
  docs: Record<string, string>,
  testFiles: Record<string, string>,
): string[] {
  const defined = extractDefinedRuleIds(docs);
  const cited = extractCitedRuleIds(testFiles);
  const failures: string[] = [];

  for (const [id, docFile] of defined) {
    if (!cited.has(id)) {
      failures.push(
        `${docFile}: rule ${id} has no test naming it. Add a test with "${id}" in its title (docs/CONVENTIONS.md → Testing).`,
      );
    }
  }

  for (const [id, files] of cited) {
    if (!defined.has(id)) {
      for (const file of files) {
        failures.push(
          `${file}: test cites unknown rule id ${id}. Define ${id} in docs/games/<gameId>.md or fix the typo.`,
        );
      }
    }
  }

  return failures.sort();
}
