import { createHash, randomUUID } from 'node:crypto';

import { QuotaSchema } from '@tablekeeper/core';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';

import { createApp } from '../app';
import { createSupabaseClients } from '../db/client';
import { findRulebook } from '../db/rules';
import { guestSubject } from '../services/quota';
import { errorBody, testConfig } from '../test/helpers';

// Every test has its own salt, so its keys and quota rows are its own; all are removed after.
const service = createSupabaseClients(testConfig().supabase).service;
const burstKeys: string[] = [];
const usageKeys: string[] = [];

function sharedStoreConfig(overrides: Record<string, string> = {}) {
  return testConfig({
    IP_HASH_SALT: `x2-${randomUUID()}`,
    RATE_LIMIT_STORE: 'database',
    RATE_LIMIT_MAX: '3',
    ...overrides,
  });
}

function burstKey(salt: string, ip: string): string {
  const key = `burst:${createHash('sha256').update(`${salt}:${ip}`).digest('hex')}`;
  burstKeys.push(key);
  return key;
}

const games = (app: ReturnType<typeof createApp>, ip: string) =>
  request(app).get('/v1/games').set('x-forwarded-for', ip);

afterAll(async () => {
  if (burstKeys.length) await service.from('rate_limit_hits').delete().in('key', burstKeys);
  if (!usageKeys.length) return;
  // Give the requests and tokens back to today's global row, then drop the guest rows.
  const { data } = await service
    .from('llm_usage')
    .delete()
    .eq('subject_type', 'ip')
    .in('subject_key', usageKeys)
    .select('requests, input_tokens, output_tokens');
  const rows = data ?? [];
  const sum = (pick: (row: (typeof rows)[number]) => number) =>
    rows.reduce((total, row) => total + pick(row), 0);
  await service.rpc('llm_record_tokens', {
    p_subject_type: 'global',
    p_subject_key: 'global',
    p_input: -sum((r) => r.input_tokens),
    p_output: -sum((r) => r.output_tokens),
  });
  const day = new Date().toISOString().slice(0, 10);
  const match = { subject_type: 'global', subject_key: 'global', day };
  const { data: global } = await service
    .from('llm_usage')
    .select('requests')
    .match(match)
    .maybeSingle();
  if (global) {
    await service
      .from('llm_usage')
      .update({ requests: Math.max(0, global.requests - sum((r) => r.requests)) })
      .match(match);
  }
});

describe('burst limit with the database store', () => {
  it('shares one count across two app instances', async () => {
    const config = sharedStoreConfig();
    const ip = '203.0.113.21';
    burstKey(config.quotas.ipHashSalt, ip);
    const first = createApp(config);
    const second = createApp(config);

    expect((await games(first, ip)).status).toBe(200);
    expect((await games(second, ip)).status).toBe(200);
    expect((await games(first, ip)).status).toBe(200);
    const fourth = await games(second, ip);
    expect(fourth.status).toBe(429);
    expect(errorBody(fourth).code).toBe('RATE_LIMITED');
    expect((await request(first).get('/health')).status).toBe(200);
  });

  it('counts concurrent requests on both instances without losing any', async () => {
    const config = sharedStoreConfig({ RATE_LIMIT_MAX: '10' });
    const ip = '203.0.113.22';
    burstKey(config.quotas.ipHashSalt, ip);
    const apps = [createApp(config), createApp(config)];
    const results = await Promise.all(
      Array.from({ length: 16 }, (_, i) => games(apps[i % 2] as (typeof apps)[number], ip)),
    );
    const statuses = results.map((res) => res.status);
    expect(statuses.filter((s) => s === 200)).toHaveLength(10);
    expect(statuses.filter((s) => s === 429)).toHaveLength(6);
  });

  it('starts a new window once the old one ends', async () => {
    const config = sharedStoreConfig({ RATE_LIMIT_MAX: '1', RATE_LIMIT_WINDOW_MS: '1000' });
    const ip = '203.0.113.23';
    burstKey(config.quotas.ipHashSalt, ip);
    const app = createApp(config);
    expect((await games(app, ip)).status).toBe(200);
    expect((await games(app, ip)).status).toBe(429);
    await new Promise((resolve) => setTimeout(resolve, 1100));
    expect((await games(app, ip)).status).toBe(200);
  });
});

describe("client IP behind Vercel's proxy", () => {
  it('keys the burst limit by the forwarded IP, stored only as a salted hash', async () => {
    const config = sharedStoreConfig({ RATE_LIMIT_MAX: '1' });
    const app = createApp(config);
    const [a, b] = ['198.51.100.31', '198.51.100.32'];
    const keyA = burstKey(config.quotas.ipHashSalt, a);
    burstKey(config.quotas.ipHashSalt, b);

    expect((await games(app, a)).status).toBe(200);
    expect((await games(app, a)).status).toBe(429);
    expect((await games(app, b)).status).toBe(200);

    const { data } = await service.from('rate_limit_hits').select('key, hits').eq('key', keyA);
    expect(data).toEqual([{ key: keyA, hits: 2 }]);
    const { data: raw } = await service.from('rate_limit_hits').select('key').like('key', `%${a}%`);
    expect(raw).toEqual([]);
  });

  it('gives each forwarded IP its own guest quota', async () => {
    const config = sharedStoreConfig({
      RATE_LIMIT_MAX: '100',
      LLM_PROVIDER: 'fake',
      LLM_GUEST_DAILY_REQUESTS: '1',
    });
    if (!(await findRulebook(service, 'azul'))) {
      throw new Error('Load the Azul rulebook first (pnpm ingest azul --load).');
    }
    const app = createApp(config);
    const [a, b] = ['198.51.100.41', '198.51.100.42'];
    for (const ip of [a, b]) {
      burstKey(config.quotas.ipHashSalt, ip);
      usageKeys.push(guestSubject(config, ip).key);
    }
    const ask = (ip: string) =>
      request(app)
        .post('/v1/games/azul/rules/ask')
        .set('x-forwarded-for', ip)
        .send({ question: 'How does the game end?' });

    expect((await ask(a)).status).toBe(200);
    const again = await ask(a);
    expect(again.status).toBe(429);
    expect(errorBody(again).code).toBe('QUOTA_EXCEEDED');

    const quotaB = await request(app).get('/v1/me/quota').set('x-forwarded-for', b);
    expect(QuotaSchema.parse(quotaB.body)).toMatchObject({ used: 0, remaining: 1 });
    expect((await ask(b)).status).toBe(200);
  });
});
