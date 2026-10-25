import { describe, expect, it } from 'vitest';

import { citationLabel } from '@/components/citation-chip';
import { ApiError } from '@/lib/api-client';

import { blockerFromQuota, describeAskFailure } from './ask-errors';

const quota = {
  enabled: true,
  subject: 'guest' as const,
  limit: 5,
  used: 5,
  remaining: 0,
  resetsAt: '2026-10-26T00:00:00.000Z',
};

describe('describeAskFailure', () => {
  it('blocks the page for switched off, missing and quota errors', () => {
    expect(describeAskFailure(new ApiError('LLM_DISABLED', 503, 'off'), false)).toEqual({
      kind: 'blocked',
      blocker: { kind: 'disabled' },
    });
    expect(describeAskFailure(new ApiError('NOT_FOUND', 404, 'x'), false)).toMatchObject({
      blocker: { kind: 'missing' },
    });
    expect(
      describeAskFailure(new ApiError('QUOTA_EXCEEDED', 429, 'x', { scope: 'global' }), true),
    ).toMatchObject({ blocker: { kind: 'quota', scope: 'global' } });
    expect(describeAskFailure(new ApiError('QUOTA_EXCEEDED', 429, 'x'), true)).toMatchObject({
      blocker: { kind: 'quota', scope: 'user' },
    });
  });

  it('keeps other failures on the turn, retryable unless the question is invalid', () => {
    expect(describeAskFailure(new ApiError('NETWORK', 0, 'x'), false)).toEqual({
      kind: 'turn',
      message: "Couldn't reach the server. Try again.",
      retryable: true,
    });
    expect(describeAskFailure(new ApiError('VALIDATION', 400, 'x'), false)).toMatchObject({
      retryable: false,
    });
    expect(describeAskFailure(new Error('boom'), false)).toMatchObject({ retryable: true });
  });
});

describe('blockerFromQuota', () => {
  it('blocks when switched off or used up', () => {
    expect(blockerFromQuota(undefined)).toBeNull();
    expect(blockerFromQuota({ ...quota, remaining: 1, used: 4 })).toBeNull();
    expect(blockerFromQuota(quota)).toEqual({
      kind: 'quota',
      scope: 'guest',
      resetsAt: quota.resetsAt,
    });
    expect(blockerFromQuota({ ...quota, enabled: false })).toEqual({ kind: 'disabled' });
  });
});

describe('citationLabel', () => {
  const citation = {
    sectionId: '6f1c7a8e-3c1e-4d4f-9b7a-2d1f0e9c8b7a',
    title: 'Scoring',
    printedPages: '4 and 5',
    pdfPage: 3,
    url: 'https://example.com/r.pdf#page=3',
  };
  it('shows the printed page, or the PDF page when none is printed', () => {
    expect(citationLabel(citation)).toBe('§ Scoring · p. 4 and 5');
    expect(citationLabel({ ...citation, printedPages: null })).toBe('§ Scoring · p. 3');
  });
});
