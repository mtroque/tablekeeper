/** Provider-neutral shapes for one model call. Providers translate them to their own API. */

export type ToolSpec = {
  name: string;
  description: string;
  /** JSON Schema of the arguments (an object schema with `additionalProperties: false`). */
  inputSchema: Record<string, unknown>;
};

export type TextBlock = { type: 'text'; text: string };
export type ToolUseBlock = { type: 'tool_use'; id: string; name: string; input: unknown };
/** A provider block the caller doesn't read (such as thinking) but must send back unchanged. */
export type OpaqueBlock = { type: 'opaque'; raw: unknown };
export type AssistantBlock = TextBlock | ToolUseBlock | OpaqueBlock;

export type ToolResultBlock = {
  type: 'tool_result';
  toolUseId: string;
  content: string;
  isError?: boolean;
};

export type LlmMessage =
  | { role: 'user'; content: string | Array<TextBlock | ToolResultBlock> }
  | { role: 'assistant'; content: string | AssistantBlock[] };

export type StopReason = 'end_turn' | 'tool_use' | 'max_tokens' | 'refusal' | 'other';

export type CompletionRequest = {
  system: string;
  messages: LlmMessage[];
  tools: ToolSpec[];
  maxOutputTokens: number;
  signal: AbortSignal;
};

export type Usage = { inputTokens: number; outputTokens: number };

export type CompletionResponse = {
  content: AssistantBlock[];
  stopReason: StopReason;
  usage: Usage;
};

export interface LlmProvider {
  readonly name: string;
  complete(request: CompletionRequest): Promise<CompletionResponse>;
}
