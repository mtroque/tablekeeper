import { createClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createTestUser, deleteUsers, testConfig, type TestUser } from '../test/helpers';

import { createUserClient } from './client';
import type { Database } from './database.types';

const config = testConfig();
let a: TestUser;
let b: TestUser;

beforeAll(async () => {
  [a, b] = await Promise.all([
    createTestUser(config, 's0-rls-a'),
    createTestUser(config, 's0-rls-b'),
  ]);
});

afterAll(async () => {
  await deleteUsers(config, [a, b]);
});

const session = {
  game_id: 'patchwork',
  status: 'completed',
  state: {},
  state_version: 0,
  score_total: 7,
};

describe('row level security', () => {
  it("keeps user A's play_sessions from user B", async () => {
    const dbA = createUserClient(config.supabase, a.token);
    const dbB = createUserClient(config.supabase, b.token);

    const inserted = await dbA.from('play_sessions').insert(session).select('id, user_id').single();
    expect(inserted.error).toBeNull();
    expect(inserted.data?.user_id).toBe(a.id);
    const id = inserted.data?.id ?? '';

    expect((await dbA.from('play_sessions').select('id').eq('id', id)).data).toHaveLength(1);
    expect((await dbB.from('play_sessions').select('id').eq('id', id)).data).toEqual([]);

    const update = await dbB
      .from('play_sessions')
      .update({ score_total: 99 })
      .eq('id', id)
      .select('id');
    expect(update.data).toEqual([]);
    const remove = await dbB.from('play_sessions').delete().eq('id', id).select('id');
    expect(remove.data).toEqual([]);
    expect(
      (await dbA.from('play_sessions').select('score_total').eq('id', id).single()).data
        ?.score_total,
    ).toBe(7);
  });

  it("won't let a user write a session as someone else", async () => {
    const dbB = createUserClient(config.supabase, b.token);
    const res = await dbB.from('play_sessions').insert({ ...session, user_id: a.id });
    expect(res.error?.code).toBe('42501');
  });

  it('keeps profiles and campaigns private', async () => {
    const dbB = createUserClient(config.supabase, b.token);
    expect((await dbB.from('profiles').select('id').eq('id', a.id)).data).toEqual([]);
    expect((await dbB.from('profiles').select('id').eq('id', b.id)).data).toHaveLength(1);

    const dbA = createUserClient(config.supabase, a.token);
    const campaign = await dbA
      .from('campaigns')
      .insert({ game_id: 'dorfromantik', state: {}, state_version: 0 })
      .select('id')
      .single();
    expect(campaign.error).toBeNull();
    expect((await dbB.from('campaigns').select('id')).data).toEqual([]);
  });

  it('gives users and guests no access to the shared tables', async () => {
    const dbA = createUserClient(config.supabase, a.token);
    const guest = createClient<Database>(config.supabase.url, config.supabase.anonKey, {
      auth: { persistSession: false },
    });
    for (const client of [dbA, guest]) {
      for (const table of ['rulebooks', 'rulebook_sections', 'llm_usage'] as const) {
        const res = await client.from(table).select('*').limit(1);
        expect(res.error?.code).toBe('42501');
      }
    }
    expect((await guest.from('play_sessions').select('id')).error?.code).toBe('42501');
  });
});
