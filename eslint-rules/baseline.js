// Lint runner with a baseline ratchet (docs/AUTOMATION.md → Principles 3).
// Existing violations listed in eslint-rules/baseline.json are tolerated up to their recorded
// count, new violations or higher counts fail, and any count that dropped prints a reminder
// to shrink the baseline.
import { readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ESLint } from 'eslint';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE_PATH = resolve(ROOT, 'eslint-rules/baseline.json');

/**
 * Compares ESLint results against a `{ [ruleId]: { [relFilePath]: count } }` baseline.
 * Returns `{ errors, warnings, reminders }` where `errors` are unbaselined or over-baseline
 * messages, and `reminders` describe baseline entries whose actual count is now lower.
 */
export function evaluateBaseline(results, baseline, rootDir = ROOT) {
  const counts = new Map();
  const byFileRule = new Map();
  const errors = [];
  const warnings = [];

  for (const result of results) {
    const file = relative(rootDir, result.filePath).replaceAll('\\', '/');
    for (const msg of result.messages) {
      if (msg.severity === 1) {
        warnings.push({ file, msg });
        continue;
      }
      const ruleId = msg.ruleId ?? '<syntax>';
      const allowed = baseline[ruleId]?.[file];
      if (allowed === undefined) {
        errors.push({ file, msg });
        continue;
      }
      const key = `${ruleId}\0${file}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
      const list = byFileRule.get(key) ?? [];
      list.push({ file, msg });
      byFileRule.set(key, list);
    }
  }

  for (const [ruleId, files] of Object.entries(baseline)) {
    for (const [file, allowed] of Object.entries(files)) {
      const key = `${ruleId}\0${file}`;
      const actual = counts.get(key) ?? 0;
      if (actual > allowed) {
        for (const item of byFileRule.get(key) ?? []) errors.push(item);
      }
    }
  }

  const reminders = [];
  for (const [ruleId, files] of Object.entries(baseline)) {
    for (const [file, allowed] of Object.entries(files)) {
      const actual = counts.get(`${ruleId}\0${file}`) ?? 0;
      if (actual < allowed) {
        reminders.push(
          `Baseline can shrink: ${ruleId} in ${file} (${actual} actual < ${allowed} recorded in eslint-rules/baseline.json).`,
        );
      }
    }
  }

  return { errors, warnings, reminders };
}

function formatItem({ file, msg }) {
  const rule = msg.ruleId ? ` (${msg.ruleId})` : '';
  return `${file}:${msg.line ?? 0}:${msg.column ?? 0}: ${msg.message}${rule}`;
}

async function main() {
  const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
  const eslint = new ESLint({ cwd: ROOT });
  const results = await eslint.lintFiles(['.']);
  const { errors, warnings, reminders } = evaluateBaseline(results, baseline, ROOT);

  for (const w of warnings) console.warn(`warn ${formatItem(w)}`);
  for (const r of reminders) console.log(r);
  if (errors.length > 0) {
    for (const e of errors) console.error(formatItem(e));
    process.exit(1);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
