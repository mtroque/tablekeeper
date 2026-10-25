import type { RulesTurn } from '@tablekeeper/core';
import type { z } from 'zod';

import type { SectionRow } from '../db/rules';
import type { GatewayModel } from '../llm/gateway';
import type { LlmMessage, TextBlock, ToolResultBlock, ToolUseBlock } from '../llm/types';

import { ANSWER_REMINDER, LIMIT_REMINDER, rulesSystemPrompt } from './prompt';
import {
  AnswerArgsSchema,
  ListArgsSchema,
  ReadSectionArgsSchema,
  RULES_TOOLS,
  SearchArgsSchema,
  toolOutput,
  type RulebookSource,
} from './tools';

export type AgentInput = {
  model: GatewayModel;
  source: RulebookSource;
  game: { name: string; edition: string };
  question: string;
  history: RulesTurn[];
  maxToolCalls: number;
  maxOutputTokens: number;
};

export type AgentResult = {
  answer: string;
  notCovered: boolean;
  /** Cited sections the agent read in this run, in the order cited. */
  cited: SectionRow[];
};

export const NO_ANSWER =
  "Couldn't find an answer in the rulebook. Try asking another way, or check the rulebook.";
const REFUSED = "That question isn't one the rules assistant can answer.";

const ANSWER_ONLY = RULES_TOOLS.filter((tool) => tool.name === 'answer');

type ToolOutcome = { content: string; isError?: boolean };

function argsError(error: z.ZodError): ToolOutcome {
  const issues = error.issues.map((i) => `${i.path.join('.') || 'arguments'}: ${i.message}`);
  return { content: `Invalid arguments. ${issues.join('; ')}`, isError: true };
}

/**
 * The agent loop (docs/ARCHITECTURE.md → Rules assistant): the model navigates one rulebook
 * with tools and ends by calling `answer`. Invalid tool calls go back to the model as tool
 * errors. Citations to sections it didn't read in this run are dropped.
 */
export async function runRulesAgent(input: AgentInput): Promise<AgentResult> {
  const { model, source } = input;
  const system = rulesSystemPrompt({ gameName: input.game.name, edition: input.game.edition });
  const read = new Map<string, SectionRow>();

  // The first message must be the user's; earlier turns are context only.
  const history = input.history.slice(input.history.findIndex((t) => t.role === 'user'));
  const messages: LlmMessage[] = [
    ...(input.history.some((t) => t.role === 'user') ? history : []).map((turn): LlmMessage => ({
      role: turn.role,
      content: turn.content,
    })),
    { role: 'user', content: input.question },
  ];

  async function runTool(use: ToolUseBlock): Promise<ToolOutcome> {
    switch (use.name) {
      case 'list_sections': {
        const args = ListArgsSchema.safeParse(use.input ?? {});
        if (!args.success) return argsError(args.error);
        return { content: JSON.stringify(toolOutput.list(await source.list())) };
      }
      case 'read_section': {
        const args = ReadSectionArgsSchema.safeParse(use.input);
        if (!args.success) return argsError(args.error);
        const section = await source.read(args.data.id);
        if (!section) {
          return { content: `No section with id ${args.data.id}.`, isError: true };
        }
        read.set(section.id, section);
        return { content: JSON.stringify(toolOutput.read(section)) };
      }
      case 'search_rulebook': {
        const args = SearchArgsSchema.safeParse(use.input);
        if (!args.success) return argsError(args.error);
        return { content: JSON.stringify(toolOutput.search(await source.search(args.data.query))) };
      }
      default:
        return { content: `Unknown tool ${use.name}.`, isError: true };
    }
  }

  function finish(answer: z.infer<typeof AnswerArgsSchema>): AgentResult {
    const cited = [...new Set(answer.citedSectionIds)]
      .map((id) => read.get(id))
      .filter((section): section is SectionRow => section !== undefined);
    // An answer with nothing it read to stand on isn't from the rulebook.
    return { answer: answer.answer, notCovered: answer.notCovered || cited.length === 0, cited };
  }

  let toolCalls = 0;
  let reminded = false;
  // Each round is one model call; the bound covers the tool calls plus the reminders.
  for (let round = 0; round < input.maxToolCalls + 3; round++) {
    const atLimit = toolCalls >= input.maxToolCalls;
    const response = await model.complete({
      system,
      messages,
      tools: atLimit ? ANSWER_ONLY : RULES_TOOLS,
      maxOutputTokens: input.maxOutputTokens,
    });
    messages.push({ role: 'assistant', content: response.content });

    const uses = response.content.filter((b): b is ToolUseBlock => b.type === 'tool_use');
    if (uses.length === 0) {
      if (response.stopReason === 'refusal')
        return { answer: REFUSED, notCovered: true, cited: [] };
      if (reminded) break;
      reminded = true;
      messages.push({ role: 'user', content: ANSWER_REMINDER });
      continue;
    }

    const results: Array<TextBlock | ToolResultBlock> = [];
    for (const use of uses) {
      if (use.name === 'answer') {
        const args = AnswerArgsSchema.safeParse(use.input);
        if (args.success) return finish(args.data);
        const error = argsError(args.error);
        results.push({ type: 'tool_result', toolUseId: use.id, ...error });
        continue;
      }
      if (toolCalls >= input.maxToolCalls) {
        results.push({
          type: 'tool_result',
          toolUseId: use.id,
          content: 'Tool call limit reached. Call the answer tool.',
          isError: true,
        });
        continue;
      }
      toolCalls += 1;
      results.push({ type: 'tool_result', toolUseId: use.id, ...(await runTool(use)) });
    }
    if (toolCalls >= input.maxToolCalls) results.push({ type: 'text', text: LIMIT_REMINDER });
    messages.push({ role: 'user', content: results });
  }
  return { answer: NO_ANSWER, notCovered: true, cited: [] };
}
