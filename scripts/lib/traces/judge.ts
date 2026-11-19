import { readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';

import { z } from 'zod';

import type { JudgeResult } from './types';

export type Rubric = { name: string; body: string };

/** Rubrics live in `.agents/skills/grade/rubrics/<name>.md`, one per file. */
export function loadRubrics(dir: string): Rubric[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .sort()
    .map((f) => ({ name: basename(f, '.md'), body: readFileSync(join(dir, f), 'utf8').trim() }));
}

const JudgeResultSchema = z.object({
  rubric: z.string(),
  label: z.string(),
  pass: z.boolean(),
  note: z.string(),
});
const JudgeOutputSchema = z.object({ results: z.array(JudgeResultSchema) });

/** JSON Schema passed to `claude --json-schema`. */
export const JUDGE_JSON_SCHEMA = {
  type: 'object',
  properties: {
    results: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          rubric: { type: 'string' },
          label: { type: 'string' },
          pass: { type: 'boolean' },
          note: { type: 'string' },
        },
        required: ['rubric', 'label', 'pass', 'note'],
      },
    },
  },
  required: ['results'],
} as const;

/** Date, pattern and where of each `docs/CORRECTIONS.md` row, so the judge can tell what was logged. */
export function correctionsIndex(markdown: string): string {
  const rows: string[] = [];
  for (const line of markdown.split(/\r?\n/)) {
    const cells = line.split('|').map((c) => c.trim());
    if (cells.length < 8 || !/^\d{4}-\d{2}-\d{2}$/.test(cells[1] ?? '')) continue;
    rows.push(`${cells[1] ?? ''} ${cells[2] ?? ''} ${(cells[3] ?? '').slice(0, 80)}`);
  }
  return rows.join('\n');
}

export function buildJudgePrompt(
  rubrics: readonly Rubric[],
  trace: string,
  logIndex: string,
): string {
  return [
    'You grade one coding-agent session from a condensed trace. Lines: `U:` user turn, `T:` tool call,',
    '`!` the error of the call above with its classifier class in brackets, `~` a flagged behavior, `F:` final message.',
    'Grade it against each rubric below and answer only with JSON: {"results":[{"rubric","label","pass","note"}]},',
    'one result per rubric, `rubric` being the rubric file name. `note` is a paraphrase of at most 25 words:',
    'never quote the trace, and name no file contents, commands, people or secrets.',
    '',
    ...rubrics.flatMap((r) => [`## Rubric \`${r.name}\``, '', r.body, '']),
    '## Corrections already logged (date, pattern, where)',
    '',
    logIndex || '(none)',
    '',
    '## Trace',
    '',
    trace,
  ].join('\n');
}

/** Strips quotes and code from a judge note and caps it, so reports hold paraphrases only. */
export function sanitizeNote(note: string): string {
  const cleaned = note
    .replaceAll(/`[^`]*`/g, '[code]')
    .replaceAll(/"[^"]*"|“[^”]*”/g, '[quote]')
    .replaceAll(/\s+/g, ' ')
    .replaceAll('|', '/')
    .trim();
  return cleaned.length > 160 ? `${cleaned.slice(0, 157)}...` : cleaned;
}

const ClaudeJsonSchema = z.looseObject({
  result: z.string().optional(),
  structured_output: z.unknown().optional(),
  is_error: z.boolean().optional(),
  usage: z
    .looseObject({
      input_tokens: z.number().optional(),
      output_tokens: z.number().optional(),
      cache_creation_input_tokens: z.number().optional(),
      cache_read_input_tokens: z.number().optional(),
    })
    .optional(),
});

function extractJson(text: string): unknown {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

/** Reads `claude -p --output-format json` output: the rubric results and the tokens it used. */
export function parseJudgeOutput(
  stdout: string,
  rubricNames: readonly string[],
): { results: JudgeResult[] | null; tokens: number } {
  const outer = ClaudeJsonSchema.safeParse(extractJson(stdout));
  if (!outer.success) return { results: null, tokens: 0 };
  const u = outer.data.usage;
  const tokens =
    (u?.input_tokens ?? 0) +
    (u?.output_tokens ?? 0) +
    (u?.cache_creation_input_tokens ?? 0) +
    (u?.cache_read_input_tokens ?? 0);
  if (outer.data.is_error === true) return { results: null, tokens };
  const inner = JudgeOutputSchema.safeParse(
    outer.data.structured_output ?? extractJson(outer.data.result ?? ''),
  );
  if (!inner.success) return { results: null, tokens };
  const results = inner.data.results
    .filter((r) => rubricNames.includes(r.rubric))
    .map((r) => ({ ...r, label: sanitizeNote(r.label).slice(0, 40), note: sanitizeNote(r.note) }));
  return { results, tokens };
}
