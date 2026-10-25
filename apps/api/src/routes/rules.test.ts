import { randomUUID } from 'node:crypto';

import { QuotaSchema, RulesAnswerSchema } from '@tablekeeper/core';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../app';
import type { Config } from '../config';
import { createSupabaseClients, type Db } from '../db/client';
import type { Subject } from '../db/quota';
import { findRulebook } from '../db/rules';
import { FakeProvider } from '../llm/fake-provider';
import { guestSubject } from '../services/quota';
import { askRules } from '../services/rules';
import { createTestUser, deleteUsers, errorBody, testConfig, type TestUser } from '../test/helpers';

// Every test uses its own salt and forwarded IP, so its guest quota starts at zero. Usage rows
// it creates are removed afterwards and taken back off the shared global row.
const GAME = 'azul';
const service: Db = createSupabaseClients(testConfig().supabase).service;
const subjects: Subject[] = [];
let createdRulebook: string | null = null;
let user: TestUser;

function guest(overrides: Record<string, string> = {}) {
  const config = testConfig({
    IP_HASH_SALT: `s3-${randomUUID()}`,
    LLM_GUEST_DAILY_REQUESTS: '2',
    LLM_USER_DAILY_REQUESTS: '4',
    ...overrides,
  });
  const ip = `203.0.113.${Math.floor(Math.random() * 250) + 1}`;
  subjects.push(guestSubject(config, ip));
  return { config, ip };
}

function appFor(config: Config, provider = new FakeProvider()) {
  return createApp(config, { llmProvider: provider });
}

const ask = (app: ReturnType<typeof appFor>, ip: string, question = 'How does the game end?') =>
  request(app).post(`/v1/games/${GAME}/rules/ask`).set('x-forwarded-for', ip).send({ question });

/** Uses the loaded rulebook, or loads a small one for the test (removed afterwards). */
async function ensureRulebook(): Promise<void> {
  if (await findRulebook(service, GAME)) return;
  const { data, error } = await service.rpc('replace_rulebook', {
    p_rulebook: {
      game_id: GAME,
      edition: 'Test',
      title: 's3 test rulebook',
      publisher_url: 'https://example.com/s3-test.pdf',
      source_version: 's3-test',
    },
    p_sections: [
      {
        key: 's1',
        parent_key: null,
        ordinal: 1,
        number: null,
        title: 'End of the game',
        pdf_page_start: 5,
        pdf_page_end: 5,
        printed_pages: '6',
        body: 'The game ends right after the round in which a player completes a line.',
      },
    ],
  });
  if (error) throw error;
  createdRulebook = data;
}

async function cleanUsage(list: Subject[]): Promise<void> {
  let requests = 0;
  let input = 0;
  let output = 0;
  for (const subject of list) {
    const { data } = await service
      .from('llm_usage')
      .delete()
      .eq('subject_type', subject.type)
      .eq('subject_key', subject.key)
      .select('requests, input_tokens, output_tokens');
    for (const row of data ?? []) {
      requests += row.requests;
      input += row.input_tokens;
      output += row.output_tokens;
    }
  }
  await service.rpc('llm_record_tokens', {
    p_subject_type: 'global',
    p_subject_key: 'global',
    p_input: -input,
    p_output: -output,
  });
  const day = new Date().toISOString().slice(0, 10);
  const { data: global } = await service
    .from('llm_usage')
    .select('requests')
    .match({ subject_type: 'global', subject_key: 'global', day })
    .maybeSingle();
  if (global) {
    await service
      .from('llm_usage')
      .update({ requests: Math.max(0, global.requests - requests) })
      .match({ subject_type: 'global', subject_key: 'global', day });
  }
}

beforeAll(async () => {
  await ensureRulebook();
  user = await createTestUser(testConfig(), 's3-rules', 'Rules Player');
  subjects.push({ type: 'user', key: user.id });
});

afterAll(async () => {
  await cleanUsage(subjects);
  await deleteUsers(testConfig(), [user]);
  if (createdRulebook) await service.from('rulebooks').delete().eq('id', createdRulebook);
});

describe('POST /v1/games/:gameId/rules/ask', () => {
  it('answers with citations that open the publisher PDF at the page', async () => {
    const { config, ip } = guest();
    const res = await ask(appFor(config), ip);
    expect(res.status).toBe(200);
    const body = RulesAnswerSchema.parse(res.body);
    expect(body.notCovered).toBe(false);
    expect(body.citations.length).toBeGreaterThan(0);
    const rulebook = await findRulebook(service, GAME);
    for (const citation of body.citations) {
      expect(citation.url).toBe(`${rulebook?.publisherUrl}#page=${citation.pdfPage}`);
    }
    expect(body.quota).toMatchObject({ subject: 'guest', limit: 2, used: 1, remaining: 1 });
  });

  it('returns notCovered with no citations for an off-topic question', async () => {
    const { config, ip } = guest();
    const res = await ask(appFor(config), ip, 'What is the capital of France?');
    expect(res.status).toBe(200);
    expect(RulesAnswerSchema.parse(res.body)).toMatchObject({ notCovered: true, citations: [] });
  });

  it('is NOT_FOUND for an unknown game or one without a loaded rulebook', async () => {
    const { config, ip } = guest();
    const res = await request(appFor(config))
      .post('/v1/games/chess/rules/ask')
      .set('x-forwarded-for', ip)
      .send({ question: 'How does the game end?' });
    expect(res.status).toBe(404);
    expect(errorBody(res).code).toBe('NOT_FOUND');

    // A registered game whose rulebook isn't loaded: the lookup finds no row.
    const noRows = {
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => ({ data: null }) }) }) }),
    } as unknown as Db;
    await expect(
      askRules(
        { config, service: noRows, gateway: undefined as never, quotas: undefined as never },
        { gameId: 'harmonies', question: 'q', history: [], subject: subjects[0] as Subject },
      ),
    ).rejects.toMatchObject({ code: 'NOT_FOUND', message: "The Harmonies rulebook wasn't found." });
  });

  it('validates the question', async () => {
    const { config, ip } = guest();
    const res = await ask(appFor(config), ip, 'x'.repeat(501));
    expect(res.status).toBe(400);
    expect(errorBody(res).code).toBe('VALIDATION');
  });

  it('gives a guest N requests, then QUOTA_EXCEEDED; a signed-in user has a separate, larger limit', async () => {
    const { config, ip } = guest();
    const app = appFor(config);
    expect((await ask(app, ip)).status).toBe(200);
    expect((await ask(app, ip)).status).toBe(200);
    const third = await ask(app, ip);
    expect(third.status).toBe(429);
    expect(errorBody(third)).toMatchObject({ code: 'QUOTA_EXCEEDED', details: { scope: 'guest' } });

    const quota = await request(app).get('/v1/me/quota').set('x-forwarded-for', ip);
    expect(QuotaSchema.parse(quota.body)).toMatchObject({ used: 2, remaining: 0, limit: 2 });

    // Same IP, signed in: the user's own quota.
    const signedIn = await ask(app, ip).set('authorization', `Bearer ${user.token}`);
    expect(signedIn.status).toBe(200);
    expect(RulesAnswerSchema.parse(signedIn.body).quota).toMatchObject({
      subject: 'user',
      limit: 4,
      used: 1,
    });
  });

  it('never lets 20 concurrent requests from one subject exceed its quota', async () => {
    const { config, ip } = guest({ LLM_GUEST_DAILY_REQUESTS: '5' });
    const app = appFor(config, new FakeProvider(undefined, { delayMs: 20 }));
    const results = await Promise.all(Array.from({ length: 20 }, () => ask(app, ip)));
    const statuses = results.map((r) => r.status);
    expect(statuses.filter((s) => s === 200)).toHaveLength(5);
    expect(statuses.filter((s) => s === 429)).toHaveLength(15);
    const quota = await request(app).get('/v1/me/quota').set('x-forwarded-for', ip);
    expect(QuotaSchema.parse(quota.body).used).toBe(5);
  });

  it('stops everyone at the global daily budget', async () => {
    const day = new Date().toISOString().slice(0, 10);
    const { data } = await service
      .from('llm_usage')
      .select('requests')
      .match({ subject_type: 'global', subject_key: 'global', day })
      .maybeSingle();
    const { config, ip } = guest({ LLM_GLOBAL_DAILY_REQUESTS: String(data?.requests ?? 1) });
    const res = await ask(appFor(config), ip);
    expect(res.status).toBe(429);
    expect(errorBody(res)).toMatchObject({ code: 'QUOTA_EXCEEDED', details: { scope: 'global' } });
  });

  it('is LLM_DISABLED behind the kill switch, and the quota says so', async () => {
    const { config, ip } = guest({ LLM_ENABLED: 'false' });
    const provider = new FakeProvider();
    const app = appFor(config, provider);
    const res = await ask(app, ip);
    expect(res.status).toBe(503);
    expect(errorBody(res).code).toBe('LLM_DISABLED');
    expect(provider.requests).toHaveLength(0);
    const quota = await request(app).get('/v1/me/quota').set('x-forwarded-for', ip);
    expect(QuotaSchema.parse(quota.body)).toMatchObject({ enabled: false, used: 0 });
  });

  it('records tokens for every model call', async () => {
    const { config, ip } = guest();
    await ask(appFor(config), ip);
    const subject = subjects.at(-1) as Subject;
    const { data } = await service
      .from('llm_usage')
      .select('requests, input_tokens, output_tokens')
      .match({ subject_type: 'ip', subject_key: subject.key })
      .single();
    // The fake provider reports 100 in and 20 out per call; this answer took 3 calls.
    expect(data).toEqual({ requests: 1, input_tokens: 300, output_tokens: 60 });
  });
});

describe('GET /v1/me/quota', () => {
  it('reports a fresh guest quota with the next UTC midnight', async () => {
    const { config, ip } = guest();
    const res = await request(appFor(config)).get('/v1/me/quota').set('x-forwarded-for', ip);
    expect(res.status).toBe(200);
    const quota = QuotaSchema.parse(res.body);
    expect(quota).toMatchObject({ enabled: true, subject: 'guest', limit: 2, used: 0 });
    expect(quota.resetsAt).toMatch(/T00:00:00\.000Z$/);
    expect(Date.parse(quota.resetsAt) - Date.now()).toBeLessThanOrEqual(86_400_000);
  });
});
