import { describe, expect, it } from 'vitest';

import { QuotaSchema } from './quota';
import { RulesAnswerSchema, RulesAskRequestSchema } from './rules';

const quota = {
  enabled: true,
  subject: 'guest',
  limit: 5,
  used: 1,
  remaining: 4,
  resetsAt: '2026-10-26T00:00:00.000Z',
} as const;

describe('rules contracts', () => {
  it('trims the question, defaults the history and caps both', () => {
    expect(RulesAskRequestSchema.parse({ question: '  How does the game end? ' })).toEqual({
      question: 'How does the game end?',
      history: [],
    });
    expect(RulesAskRequestSchema.safeParse({ question: '   ' }).success).toBe(false);
    expect(RulesAskRequestSchema.safeParse({ question: 'x'.repeat(501) }).success).toBe(false);
    const turn = { role: 'user', content: 'Hi' };
    expect(
      RulesAskRequestSchema.safeParse({ question: 'q', history: Array(7).fill(turn) }).success,
    ).toBe(false);
    expect(
      RulesAskRequestSchema.safeParse({ question: 'q', history: [{ role: 'system', content: 'x' }] })
        .success,
    ).toBe(false);
  });

  it('accepts an answer with citations and a null printed page', () => {
    const citation = {
      sectionId: '6f1c7a8e-3c1e-4d4f-9b7a-2d1f0e9c8b7a',
      title: 'End of the Game',
      printedPages: null,
      pdfPage: 2,
      url: 'https://example.com/rules.pdf#page=2',
    };
    const answer = {
      answer: 'The game ends when every player has passed.',
      notCovered: false,
      citations: [citation],
      quota,
    };
    expect(RulesAnswerSchema.parse(answer)).toEqual(answer);
    expect(
      RulesAnswerSchema.safeParse({ ...answer, citations: [{ ...citation, pdfPage: 0 }] }).success,
    ).toBe(false);
  });

  it('validates the quota', () => {
    expect(QuotaSchema.parse(quota)).toEqual(quota);
    expect(QuotaSchema.safeParse({ ...quota, remaining: -1 }).success).toBe(false);
  });
});
