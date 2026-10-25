import type { Quota } from '@tablekeeper/core';

import { ApiError } from '@/lib/api-client';

/** What stops new questions entirely, shown in place of the input. */
export type Blocker =
  | { kind: 'disabled' }
  | { kind: 'missing' }
  | { kind: 'quota'; scope: 'guest' | 'user' | 'global'; resetsAt: string | null };

/** How a failed question is shown: as a block on the page, or on that turn with a retry. */
export type AskFailure =
  { kind: 'blocked'; blocker: Blocker } | { kind: 'turn'; message: string; retryable: boolean };

function scopeOf(details: unknown): 'guest' | 'user' | 'global' | null {
  if (typeof details !== 'object' || details === null || !('scope' in details)) return null;
  const { scope } = details;
  return scope === 'guest' || scope === 'user' || scope === 'global' ? scope : null;
}

export function describeAskFailure(error: unknown, signedIn: boolean): AskFailure {
  if (!(error instanceof ApiError)) {
    return { kind: 'turn', message: "Couldn't get an answer. Try again.", retryable: true };
  }
  switch (error.code) {
    case 'LLM_DISABLED':
      return { kind: 'blocked', blocker: { kind: 'disabled' } };
    case 'NOT_FOUND':
      return { kind: 'blocked', blocker: { kind: 'missing' } };
    case 'QUOTA_EXCEEDED':
      return {
        kind: 'blocked',
        blocker: {
          kind: 'quota',
          scope: scopeOf(error.details) ?? (signedIn ? 'user' : 'guest'),
          resetsAt: null,
        },
      };
    case 'VALIDATION':
      return {
        kind: 'turn',
        message: 'Questions can be up to 500 characters. Shorten it and ask again.',
        retryable: false,
      };
    case 'RATE_LIMITED':
      return { kind: 'turn', message: error.message, retryable: true };
    case 'NETWORK':
      return {
        kind: 'turn',
        message: "Couldn't reach the server. Try again.",
        retryable: true,
      };
    default:
      return { kind: 'turn', message: error.message, retryable: true };
  }
}

/** The block a quota alone implies (switched off, or nothing left today). */
export function blockerFromQuota(quota: Quota | undefined): Blocker | null {
  if (!quota) return null;
  if (!quota.enabled) return { kind: 'disabled' };
  if (quota.remaining === 0) {
    return { kind: 'quota', scope: quota.subject, resetsAt: quota.resetsAt };
  }
  return null;
}
