import { describe, expect, it } from 'vitest';

import type { SectionRow } from '../db/rules';
import { FakeProvider, fakeToolUse, rulebookReader, type FakeStep } from '../llm/fake-provider';
import type { GatewayModel } from '../llm/gateway';
import type { ToolResultBlock } from '../llm/types';
import { removeDashes } from '../services/rules';

import { NO_ANSWER, runRulesAgent } from './agent';
import { RULES_PROMPT_VERSION, rulesSystemPrompt } from './prompt';
import type { RulebookSource } from './tools';

const END = '11111111-1111-4111-8111-111111111111';
const SETUP = '22222222-2222-4222-8222-222222222222';

const section = (id: string, title: string, body: string): SectionRow => ({
  id,
  number: null,
  title,
  parentId: null,
  printedPages: '6',
  pdfPageStart: 5,
  pdfPageEnd: 5,
  body,
});

const SECTIONS = [
  section(SETUP, 'Game Setup', 'Each player takes a board.'),
  section(END, 'End of the game', 'The game ends after a horizontal line is complete.'),
];

const source: RulebookSource = {
  list: () => Promise.resolve(SECTIONS),
  read: (id) => Promise.resolve(SECTIONS.find((s) => s.id === id) ?? null),
  search: (query) =>
    Promise.resolve(
      SECTIONS.filter((s) => /end/i.test(query) && s.id === END).map((s) => ({
        id: s.id,
        number: s.number,
        title: s.title,
        printedPages: s.printedPages,
        pdfPageStart: s.pdfPageStart,
        pdfPageEnd: s.pdfPageEnd,
        snippet: s.body,
      })),
    ),
};

function modelOf(provider: FakeProvider): GatewayModel {
  return {
    complete: (request) => provider.complete({ ...request, signal: new AbortController().signal }),
  };
}

function ask(steps: FakeStep[], question = 'How does the game end?', maxToolCalls = 6) {
  const provider = new FakeProvider(steps);
  const run = runRulesAgent({
    model: modelOf(provider),
    source,
    game: { name: 'Azul', edition: 'Master Chocolatier' },
    question,
    history: [],
    maxToolCalls,
    maxOutputTokens: 800,
  });
  return { provider, run };
}

const lastResults = (provider: FakeProvider, call: number): ToolResultBlock[] => {
  const last = provider.requests[call]?.messages.at(-1);
  if (!last || typeof last.content === 'string') return [];
  return last.content.filter((b): b is ToolResultBlock => b.type === 'tool_result');
};

describe('runRulesAgent', () => {
  it('searches, reads and answers with a citation', async () => {
    const { provider, run } = ask([rulebookReader]);
    const result = await run;
    expect(result.notCovered).toBe(false);
    expect(result.cited.map((s) => s.id)).toEqual([END]);
    expect(provider.requests).toHaveLength(3);
    expect(provider.requests[0]?.system).toContain('Azul (Master Chocolatier edition)');
  });

  it('answers notCovered for an off-topic question', async () => {
    const result = await ask([rulebookReader], 'What is the capital of France?').run;
    expect(result).toEqual({ answer: "The rulebook doesn't say.", notCovered: true, cited: [] });
  });

  it('drops citations to sections it did not read, and an uncited answer is notCovered', async () => {
    const result = await ask([
      () => [fakeToolUse('answer', { answer: 'Yes.', citedSectionIds: [END], notCovered: false })],
    ]).run;
    expect(result).toEqual({ answer: 'Yes.', notCovered: true, cited: [] });
  });

  it('keeps only read citations when some were read', async () => {
    const result = await ask([
      () => [fakeToolUse('read_section', { id: SETUP })],
      () => [
        fakeToolUse('answer', {
          answer: 'Each player takes a board.',
          citedSectionIds: [SETUP, END, SETUP],
          notCovered: false,
        }),
      ],
    ]).run;
    expect(result.cited.map((s) => s.title)).toEqual(['Game Setup']);
    expect(result.notCovered).toBe(false);
  });

  it('returns invalid tool arguments to the model as tool errors', async () => {
    const { provider, run } = ask([
      () => [fakeToolUse('read_section', { id: 'not-a-uuid' }), fakeToolUse('teleport', {})],
      () => [fakeToolUse('answer', { answer: '', citedSectionIds: [], notCovered: false })],
      () => [fakeToolUse('answer', { answer: 'No.', citedSectionIds: [], notCovered: true })],
    ]);
    const result = await run;
    expect(result.answer).toBe('No.');
    const first = lastResults(provider, 1);
    expect(first.map((r) => r.isError)).toEqual([true, true]);
    expect(first[0]?.content).toMatch(/^Invalid arguments\. id:/);
    expect(first[1]?.content).toBe('Unknown tool teleport.');
    expect(lastResults(provider, 2)[0]?.content).toMatch(/answer:/);
  });

  it('stops offering tools at the tool call limit', async () => {
    const { provider, run } = ask(
      [
        () => [fakeToolUse('list_sections', {}), fakeToolUse('list_sections', {})],
        () => [fakeToolUse('list_sections', {})],
      ],
      'How does the game end?',
      1,
    );
    expect(await run).toEqual({ answer: NO_ANSWER, notCovered: true, cited: [] });
    expect(provider.requests[0]?.tools.map((t) => t.name)).toHaveLength(4);
    expect(provider.requests[1]?.tools.map((t) => t.name)).toEqual(['answer']);
    expect(lastResults(provider, 1).map((r) => r.isError ?? false)).toEqual([false, true]);
    // 1 tool call + 3 rounds of slack, never more.
    expect(provider.requests.length).toBeLessThanOrEqual(4);
  });

  it('reminds once when the model answers in text, then gives up', async () => {
    const { provider, run } = ask([() => [{ type: 'text', text: 'It ends eventually.' }]]);
    expect(await run).toEqual({ answer: NO_ANSWER, notCovered: true, cited: [] });
    expect(provider.requests).toHaveLength(2);
    expect(provider.requests[1]?.messages.at(-1)).toMatchObject({ role: 'user' });
  });

  it('sends earlier turns as context, starting with a user turn', async () => {
    const provider = new FakeProvider([rulebookReader]);
    await runRulesAgent({
      model: modelOf(provider),
      source,
      game: { name: 'Azul', edition: 'Master Chocolatier' },
      question: 'And then?',
      history: [
        { role: 'assistant', content: 'stray' },
        { role: 'user', content: 'How does the game end?' },
        { role: 'assistant', content: 'After a line is complete.' },
      ],
      maxToolCalls: 6,
      maxOutputTokens: 800,
    });
    expect(provider.requests[0]?.messages.map((m) => m.content)).toEqual([
      'How does the game end?',
      'After a line is complete.',
      'And then?',
    ]);
  });
});

describe('prompt', () => {
  it('is versioned and states the rules', () => {
    expect(RULES_PROMPT_VERSION).toMatch(/^rules-/);
    const prompt = rulesSystemPrompt({ gameName: 'Harmonies', edition: 'Base Game' });
    expect(prompt).toContain('Never add rules');
    expect(prompt).toContain('notCovered');
    expect(prompt).not.toMatch(/[–—]/);
  });
});

describe('removeDashes', () => {
  it('turns ranges into "to" and other dashes into commas', () => {
    expect(removeDashes('Score 2–4 points')).toBe('Score 2 to 4 points');
    expect(removeDashes('Yes — you collect pralines.')).toBe('Yes, you collect pralines.');
    expect(removeDashes('No—.')).toBe('No.');
    expect(removeDashes('Plain text.')).toBe('Plain text.');
  });
});
