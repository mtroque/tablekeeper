import pino from 'pino';
import { describe, expect, it } from 'vitest';

import type { Subject } from '../db/quota';
import { AppError } from '../errors';
import { testConfig } from '../test/helpers';

import { createGateway } from './gateway';
import type { QuotaLimits, QuotaStore } from './quota-store';
import type { CompletionResponse, LlmProvider, Usage } from './types';

function memoryQuotas(initial: { subject?: number; global?: number } = {}) {
  let subjectUsed = initial.subject ?? 0;
  let globalUsed = initial.global ?? 0;
  const tokens: Usage[] = [];
  let refunds = 0;

  const store: QuotaStore = {
    consume(_subject: Subject, limits: QuotaLimits) {
      if (globalUsed >= limits.globalRequests) return Promise.resolve('global');
      if (subjectUsed >= limits.subject) return Promise.resolve('subject');
      globalUsed += 1;
      subjectUsed += 1;
      return Promise.resolve(null);
    },
    refund() {
      refunds += 1;
      globalUsed = Math.max(0, globalUsed - 1);
      subjectUsed = Math.max(0, subjectUsed - 1);
      return Promise.resolve();
    },
    recordTokens(_subject: Subject, usage: Usage) {
      tokens.push(usage);
      return Promise.resolve();
    },
    used() {
      return Promise.resolve(subjectUsed);
    },
  };

  return {
    store,
    state: () => ({ subjectUsed, globalUsed, tokens, refunds }),
  };
}

const subject: Subject = { type: 'ip', key: 'guest-1' };
const logger = pino({ level: 'silent' });
const sampleResponse: CompletionResponse = {
  content: [{ type: 'text', text: 'ok' }],
  stopReason: 'end_turn',
  usage: { inputTokens: 100, outputTokens: 20 },
};

describe('createGateway', () => {
  it('counts 1 on success and records tokens', async () => {
    const config = testConfig({ LLM_GUEST_DAILY_REQUESTS: '2' });
    const quotas = memoryQuotas();
    const provider: LlmProvider = {
      name: 'test',
      complete: () => Promise.resolve(sampleResponse),
    };
    const gateway = createGateway({ config, provider, quotas: quotas.store, logger });

    const out = await gateway.run({ purpose: 'rules', subject, limits: { timeoutMs: 1000 } }, (m) =>
      m.complete({ system: 's', messages: [], tools: [], maxOutputTokens: 100 }),
    );

    expect(out.usage).toEqual({ inputTokens: 100, outputTokens: 20 });
    expect(quotas.state()).toEqual({
      subjectUsed: 1,
      globalUsed: 1,
      tokens: [{ inputTokens: 100, outputTokens: 20 }],
      refunds: 0,
    });
  });

  it('refunds the request when the provider throws', async () => {
    const config = testConfig({ LLM_GUEST_DAILY_REQUESTS: '2' });
    const quotas = memoryQuotas();
    const provider: LlmProvider = {
      name: 'failing',
      complete: () => Promise.reject(new Error('401 invalid x-api-key')),
    };
    const gateway = createGateway({ config, provider, quotas: quotas.store, logger });

    await expect(
      gateway.run({ purpose: 'rules', subject, limits: { timeoutMs: 1000 } }, (m) =>
        m.complete({ system: 's', messages: [], tools: [], maxOutputTokens: 100 }),
      ),
    ).rejects.toMatchObject({ code: 'INTERNAL', status: 502 });

    expect(quotas.state()).toEqual({
      subjectUsed: 0,
      globalUsed: 0,
      tokens: [{ inputTokens: 0, outputTokens: 0 }],
      refunds: 1,
    });
  });

  it('refunds the request when work fails before calling the model', async () => {
    const config = testConfig({ LLM_GUEST_DAILY_REQUESTS: '2' });
    const quotas = memoryQuotas();
    const provider: LlmProvider = {
      name: 'test',
      complete: () => Promise.resolve(sampleResponse),
    };
    const gateway = createGateway({ config, provider, quotas: quotas.store, logger });

    await expect(
      gateway.run({ purpose: 'rules', subject, limits: { timeoutMs: 1000 } }, () =>
        Promise.reject(new Error('db connection failed')),
      ),
    ).rejects.toThrow('db connection failed');

    expect(quotas.state()).toEqual({
      subjectUsed: 0,
      globalUsed: 0,
      tokens: [],
      refunds: 1,
    });
  });

  it('does not change usage or refund on QUOTA_EXCEEDED', async () => {
    const config = testConfig({ LLM_GUEST_DAILY_REQUESTS: '2' });
    const quotas = memoryQuotas({ subject: 2, global: 2 });
    const provider: LlmProvider = {
      name: 'test',
      complete: () => Promise.resolve(sampleResponse),
    };
    const gateway = createGateway({ config, provider, quotas: quotas.store, logger });

    await expect(
      gateway.run({ purpose: 'rules', subject, limits: { timeoutMs: 1000 } }, (m) =>
        m.complete({ system: 's', messages: [], tools: [], maxOutputTokens: 100 }),
      ),
    ).rejects.toBeInstanceOf(AppError);

    expect(quotas.state()).toEqual({
      subjectUsed: 2,
      globalUsed: 2,
      tokens: [],
      refunds: 0,
    });
  });

  it('keeps the request counted and records tokens on timeout', async () => {
    const config = testConfig({ LLM_GUEST_DAILY_REQUESTS: '2' });
    const quotas = memoryQuotas();
    const provider: LlmProvider = {
      name: 'slow',
      complete: ({ signal }) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => {
            reject(new Error('aborted'));
          });
        }),
    };
    const gateway = createGateway({ config, provider, quotas: quotas.store, logger });

    await expect(
      gateway.run({ purpose: 'rules', subject, limits: { timeoutMs: 15 } }, (m) =>
        m.complete({ system: 's', messages: [], tools: [], maxOutputTokens: 100 }),
      ),
    ).rejects.toMatchObject({ code: 'INTERNAL', status: 504 });

    expect(quotas.state()).toEqual({
      subjectUsed: 1,
      globalUsed: 1,
      tokens: [{ inputTokens: 0, outputTokens: 0 }],
      refunds: 0,
    });
  });
});
