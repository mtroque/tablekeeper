import { z } from 'zod';

import { clip, clipError, summarizeArg } from './args';
import type { Session, ToolEvent, TraceEvent } from './types';

const ToolCallSchema = z.looseObject({
  name: z.string().optional(),
  args: z.unknown().optional(),
  arguments: z.unknown().optional(),
  function: z.looseObject({ name: z.string(), arguments: z.unknown().optional() }).optional(),
});

const StepSchema = z.looseObject({
  step_index: z.number().optional(),
  created_at: z.string().optional(),
  status: z.string().optional(),
  source: z.string().optional(),
  type: z.string(),
  content: z.unknown().optional(),
  tool_calls: z.array(ToolCallSchema).optional(),
  model: z.string().optional(),
  input_tokens: z.number().optional(),
  output_tokens: z.number().optional(),
});

const EXIT_RE = /Command exited with code (\d+)/;

function toText(content: unknown): string {
  if (content === undefined || content === null) return '';
  return typeof content === 'string' ? content : JSON.stringify(content);
}

function toInput(raw: unknown): Record<string, unknown> {
  let value = raw;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return { value };
    }
  }
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/**
 * Parses an Antigravity `transcript_full.jsonl` (one step per line) into a condensed session.
 * Tool results are the steps that follow a `PLANNER_RESPONSE`, matched to its calls in order.
 */
export function parseAntigravityTranscript(jsonl: string, conversationId: string): Session {
  const events: TraceEvent[] = [];
  const pending: ToolEvent[] = [];
  const models = new Set<string>();
  const tokens = { input: 0, output: 0 };
  let startedAt: string | null = null;
  let endedAt: string | null = null;
  let finalText: string | null = null;

  for (const raw of jsonl.split(/\r?\n/)) {
    if (!raw.trim()) continue;
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      continue;
    }
    const parsed = StepSchema.safeParse(json);
    if (!parsed.success) continue;
    const step = parsed.data;
    if (step.created_at) {
      startedAt ??= step.created_at;
      endedAt = step.created_at;
    }
    const text = toText(step.content);
    const failed =
      step.status === 'ERROR' ||
      step.status === 'INVALID' ||
      Number.parseInt(EXIT_RE.exec(text)?.[1] ?? '0', 10) !== 0;

    if (step.type === 'USER_INPUT') {
      pending.length = 0;
      if (/interrupted|cancell?ed by (the )?user/i.test(text)) events.push({ kind: 'interrupt' });
      else events.push({ kind: 'user', text: clip(text, 300) });
      continue;
    }

    if (step.type === 'PLANNER_RESPONSE') {
      if (step.model) models.add(step.model);
      tokens.input += step.input_tokens ?? 0;
      tokens.output += step.output_tokens ?? 0;
      const calls = step.tool_calls ?? [];
      if (calls.length === 0 && text) finalText = text;
      pending.length = 0;
      for (const call of calls) {
        const name = call.function?.name ?? call.name ?? 'unknown';
        const input = toInput(call.function?.arguments ?? call.args ?? call.arguments);
        const event: ToolEvent = {
          kind: 'tool',
          name,
          arg: summarizeArg(name, input, null),
          input,
          error: null,
        };
        events.push(event);
        pending.push(event);
      }
      continue;
    }

    if (step.type === 'SYSTEM_MESSAGE') continue;

    // GENERIC: the result of the next pending call.
    const tool = pending.shift();
    if (!failed) continue;
    const error = clipError(text) || (step.status ?? 'error');
    if (tool) tool.error = error;
    else events.push({ kind: 'tool', name: 'unknown', arg: '', input: {}, error });
  }

  if (finalText !== null) events.push({ kind: 'final', text: clip(finalText, 600) });

  return {
    id: conversationId,
    runner: 'agy',
    startedAt,
    endedAt,
    cwd: null,
    branch: null,
    models: [...models],
    tokens,
    events,
  };
}
