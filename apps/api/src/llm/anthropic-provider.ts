import Anthropic from '@anthropic-ai/sdk';

import type {
  AssistantBlock,
  CompletionRequest,
  CompletionResponse,
  LlmMessage,
  LlmProvider,
  StopReason,
} from './types';

import Beta = Anthropic.Beta;

/** The model used when `LLM_MODEL_RULES` is unset. */
export const DEFAULT_RULES_MODEL = 'claude-opus-5-5';

export type AnthropicProviderOptions = {
  apiKey?: string | undefined;
  model?: string | undefined;
  /** For tests and the smoke script. */
  client?: Anthropic;
};

function toParam(message: LlmMessage): Beta.BetaMessageParam {
  if (typeof message.content === 'string') return { role: message.role, content: message.content };
  if (message.role === 'user') {
    return {
      role: 'user',
      content: message.content.map((block): Beta.BetaContentBlockParam =>
        block.type === 'text'
          ? { type: 'text', text: block.text }
          : {
              type: 'tool_result',
              tool_use_id: block.toolUseId,
              content: block.content,
              ...(block.isError ? { is_error: true } : {}),
            },
      ),
    };
  }
  return {
    role: 'assistant',
    content: message.content.map((block): Beta.BetaContentBlockParam => {
      switch (block.type) {
        case 'text':
          return { type: 'text', text: block.text };
        case 'tool_use':
          return { type: 'tool_use', id: block.id, name: block.name, input: block.input };
        case 'opaque':
          // Thinking and fallback blocks go back exactly as the API sent them.
          return block.raw as Beta.BetaContentBlockParam;
      }
    }),
  };
}

function toBlock(block: Beta.BetaContentBlock): AssistantBlock {
  if (block.type === 'text') return { type: 'text', text: block.text };
  if (block.type === 'tool_use') {
    return { type: 'tool_use', id: block.id, name: block.name, input: block.input };
  }
  return { type: 'opaque', raw: block };
}

function toStopReason(reason: Beta.BetaStopReason | null): StopReason {
  switch (reason) {
    case 'end_turn':
    case 'tool_use':
    case 'max_tokens':
    case 'refusal':
      return reason;
    default:
      return 'other';
  }
}

/** Claude through the Anthropic API, with a server-side fallback when a request is declined. */
export class AnthropicProvider implements LlmProvider {
  readonly name = 'anthropic';
  readonly model: string;
  private readonly client: Anthropic;

  constructor(options: AnthropicProviderOptions = {}) {
    this.model = options.model ?? DEFAULT_RULES_MODEL;
    this.client =
      options.client ??
      new Anthropic({ ...(options.apiKey ? { apiKey: options.apiKey } : {}), maxRetries: 1 });
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const response = await this.client.beta.messages.create(
      {
        model: this.model,
        max_tokens: request.maxOutputTokens,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: 'medium' },
        system: request.system,
        messages: request.messages.map(toParam),
        tools: request.tools.map((tool) => ({
          name: tool.name,
          description: tool.description,
          input_schema: tool.inputSchema as Beta.BetaTool.InputSchema,
          strict: true,
        })),
        tool_choice: { type: 'auto' },
      },
      { signal: request.signal },
    );
    return {
      content: response.content.map(toBlock),
      stopReason: toStopReason(response.stop_reason),
      usage: {
        inputTokens:
          response.usage.input_tokens +
          (response.usage.cache_creation_input_tokens ?? 0) +
          (response.usage.cache_read_input_tokens ?? 0),
        outputTokens: response.usage.output_tokens,
      },
    };
  }
}
