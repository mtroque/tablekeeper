import { z } from 'zod';

import { clip, clipError, summarizeArg } from './args';
import type { Session, ToolEvent, TraceEvent } from './types';

const BlockSchema = z.looseObject({
  type: z.string(),
  text: z.string().optional(),
  id: z.string().optional(),
  name: z.string().optional(),
  input: z.record(z.string(), z.unknown()).optional(),
  tool_use_id: z.string().optional(),
  is_error: z.boolean().optional(),
  content: z.unknown().optional(),
});

const LineSchema = z.looseObject({
  type: z.string(),
  sessionId: z.string().optional(),
  timestamp: z.string().optional(),
  cwd: z.string().optional(),
  gitBranch: z.string().optional(),
  isSidechain: z.boolean().optional(),
  isMeta: z.boolean().optional(),
  isCompactSummary: z.boolean().optional(),
  message: z
    .looseObject({
      id: z.string().optional(),
      role: z.string().optional(),
      model: z.string().optional(),
      content: z.union([z.string(), z.array(BlockSchema)]).optional(),
      usage: z
        .looseObject({
          input_tokens: z.number().optional(),
          output_tokens: z.number().optional(),
          cache_creation_input_tokens: z.number().optional(),
          cache_read_input_tokens: z.number().optional(),
        })
        .optional(),
    })
    .optional(),
});

/** Texts injected by the harness rather than typed by the user. */
const META_TEXT_RE =
  /^\s*(<system-reminder>|<local-command|<command-message>|Caveat:|Base directory for this skill)/;
const INTERRUPT_RE = /\[Request interrupted by user/;

export function blockText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part: unknown) =>
        part && typeof part === 'object' && 'text' in part && typeof part.text === 'string'
          ? part.text
          : '',
      )
      .join('\n');
  }
  return '';
}

function userText(text: string): string | null {
  const command = /<command-name>([^<]+)<\/command-name>/.exec(text);
  if (command) {
    const args = /<command-args>([^<]*)<\/command-args>/.exec(text)?.[1] ?? '';
    return `${command[1] ?? ''} ${args}`.trim();
  }
  if (META_TEXT_RE.test(text)) return null;
  return text;
}

/**
 * Parses a Claude Code session transcript (`~/.claude/projects/<repo>/<session>.jsonl`) into a
 * condensed session. Sidechain (subagent) messages count as tool calls but not as user turns.
 */
export function parseClaudeTranscript(jsonl: string, fallbackId = 'unknown'): Session {
  const events: TraceEvent[] = [];
  const toolsById = new Map<string, ToolEvent>();
  const seenMessageIds = new Set<string>();
  const models = new Set<string>();
  const tokens = { input: 0, output: 0 };
  let id: string | null = null;
  let startedAt: string | null = null;
  let endedAt: string | null = null;
  let cwd: string | null = null;
  let branch: string | null = null;
  let finalText: string | null = null;

  for (const raw of jsonl.split(/\r?\n/)) {
    if (!raw.trim()) continue;
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      continue;
    }
    const parsed = LineSchema.safeParse(json);
    if (!parsed.success) continue;
    const line = parsed.data;
    if (line.type !== 'user' && line.type !== 'assistant') continue;

    id ??= line.sessionId ?? null;
    cwd ??= line.cwd ?? null;
    if (line.gitBranch) branch ??= line.gitBranch;
    if (line.timestamp) {
      startedAt ??= line.timestamp;
      endedAt = line.timestamp;
    }

    const message = line.message;
    if (!message) continue;
    const content = message.content;

    if (line.type === 'assistant') {
      if (message.model && !message.model.startsWith('<')) models.add(message.model);
      if (message.usage && message.id && !seenMessageIds.has(message.id)) {
        seenMessageIds.add(message.id);
        tokens.input +=
          (message.usage.input_tokens ?? 0) +
          (message.usage.cache_creation_input_tokens ?? 0) +
          (message.usage.cache_read_input_tokens ?? 0);
        tokens.output += message.usage.output_tokens ?? 0;
      }
      if (!Array.isArray(content)) continue;
      for (const block of content) {
        if (block.type === 'text' && block.text && !line.isSidechain) finalText = block.text;
        if (block.type === 'tool_use' && block.name) {
          const input = block.input ?? {};
          const event: ToolEvent = {
            kind: 'tool',
            name: block.name,
            arg: summarizeArg(block.name, input, cwd),
            input,
            error: null,
          };
          events.push(event);
          if (block.id) toolsById.set(block.id, event);
        }
      }
      continue;
    }

    // User line: either tool results or a typed turn.
    if (typeof content === 'string') {
      if (line.isSidechain || line.isMeta || line.isCompactSummary) continue;
      if (INTERRUPT_RE.test(content)) events.push({ kind: 'interrupt' });
      else {
        const text = userText(content);
        if (text !== null) events.push({ kind: 'user', text: clip(text, 300) });
      }
      continue;
    }
    for (const block of content ?? []) {
      if (block.type === 'tool_result' && block.tool_use_id) {
        const tool = toolsById.get(block.tool_use_id);
        if (tool && block.is_error === true) {
          tool.error = clipError(blockText(block.content)) || 'error';
        }
        continue;
      }
      if (block.type === 'text' && block.text !== undefined) {
        if (line.isSidechain || line.isMeta || line.isCompactSummary) continue;
        if (INTERRUPT_RE.test(block.text)) {
          events.push({ kind: 'interrupt' });
          continue;
        }
        const text = userText(block.text);
        if (text !== null) events.push({ kind: 'user', text: clip(text, 300) });
      }
    }
  }

  if (finalText !== null) events.push({ kind: 'final', text: clip(finalText, 600) });

  return {
    id: id ?? fallbackId,
    runner: 'claude',
    startedAt,
    endedAt,
    cwd,
    branch,
    models: [...models],
    tokens,
    events,
  };
}
