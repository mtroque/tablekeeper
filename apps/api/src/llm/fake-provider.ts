import type {
  AssistantBlock,
  CompletionRequest,
  CompletionResponse,
  LlmMessage,
  LlmProvider,
  ToolResultBlock,
} from './types';

/** One scripted turn: what the model "says" given the request so far. */
export type FakeStep = (request: CompletionRequest) => AssistantBlock[];

const FAKE_USAGE = { inputTokens: 100, outputTokens: 20 };

let nextId = 0;
export function fakeToolUse(name: string, input: unknown): AssistantBlock {
  nextId += 1;
  return { type: 'tool_use', id: `fake_${nextId}`, name, input };
}

function lastToolResult(messages: LlmMessage[]): ToolResultBlock | undefined {
  const last = messages.at(-1);
  if (!last || last.role !== 'user' || typeof last.content === 'string') return undefined;
  return last.content.find((block): block is ToolResultBlock => block.type === 'tool_result');
}

function lastQuestion(messages: LlmMessage[]): string {
  for (const message of [...messages].reverse()) {
    if (message.role === 'user' && typeof message.content === 'string') return message.content;
  }
  return '';
}

function parse(text: string | undefined): unknown {
  try {
    return text === undefined ? undefined : JSON.parse(text);
  } catch {
    return undefined;
  }
}

/**
 * Reads the rulebook the way the real agent should: search for the question, read the best
 * section, then answer citing it, or answer `notCovered` when the search finds nothing.
 * Deterministic and offline; used by `LLM_PROVIDER=fake` and the end to end tests.
 */
export const rulebookReader: FakeStep = (request) => {
  const result = lastToolResult(request.messages);
  const value = parse(result?.content);
  if (!result) return [fakeToolUse('search_rulebook', { query: lastQuestion(request.messages) })];
  if (Array.isArray(value)) {
    const top: unknown = value[0];
    if (top && typeof top === 'object' && 'id' in top && typeof top.id === 'string') {
      return [fakeToolUse('read_section', { id: top.id })];
    }
    return [
      fakeToolUse('answer', {
        answer: "The rulebook doesn't say.",
        citedSectionIds: [],
        notCovered: true,
      }),
    ];
  }
  if (value && typeof value === 'object' && 'id' in value && typeof value.id === 'string') {
    const title = 'title' in value && typeof value.title === 'string' ? value.title : 'the rules';
    return [
      fakeToolUse('answer', {
        answer: `The rulebook covers this under ${title}.`,
        citedSectionIds: [value.id],
        notCovered: false,
      }),
    ];
  }
  return [{ type: 'text', text: 'Done.' }];
};

/**
 * A scripted provider for tests. With a list of steps, each call plays the next one (the last
 * repeats); with none, it plays `rulebookReader`. Every request is kept in `requests`.
 */
export class FakeProvider implements LlmProvider {
  readonly name = 'fake';
  readonly requests: CompletionRequest[] = [];
  private readonly steps: FakeStep[];
  private readonly delayMs: number;

  constructor(steps: FakeStep[] = [rulebookReader], options: { delayMs?: number } = {}) {
    this.steps = steps;
    this.delayMs = options.delayMs ?? 0;
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    this.requests.push({ ...request, messages: [...request.messages] });
    if (this.delayMs > 0) {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(resolve, this.delayMs);
        request.signal.addEventListener('abort', () => {
          clearTimeout(timer);
          reject(new Error('aborted'));
        });
      });
    }
    const step = this.steps[Math.min(this.requests.length - 1, this.steps.length - 1)];
    const content = step ? step(request) : [];
    return {
      content,
      stopReason: content.some((block) => block.type === 'tool_use') ? 'tool_use' : 'end_turn',
      usage: FAKE_USAGE,
    };
  }
}
