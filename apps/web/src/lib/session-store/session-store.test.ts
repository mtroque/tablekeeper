import type { GameId, Session, SessionInput } from '@tablekeeper/core';
import { describe, expect, it } from 'vitest';

import { detectionMeta } from './detection-meta';
import { clearFlow, readFlow, writeFlow, type FlowState } from './flow-state';
import { LocalStore, type KeyValue } from './local-store';
import { resumePendingSaveWith, setPendingSave } from './pending-save';
import type { SessionStore } from './session-store';

function memory(): KeyValue & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
    removeItem: (key) => {
      data.delete(key);
    },
  };
}

// The example game isn't a GameId (kit/types.ts is frozen); the registry finds it in tests.
const EXAMPLE = '_example' as GameId;
const board = (covered: number) => ({ cells: Array.from({ length: 9 }, (_, i) => i < covered) });
let next = 0;
const ids = () => `00000000-0000-4000-8000-${String(++next).padStart(12, '0')}`;

describe('LocalStore', () => {
  it('scores locally, keeps in-progress sessions and stores no history', async () => {
    const storage = memory();
    const store = new LocalStore(storage, ids);
    const session = await store.save({
      gameId: EXAMPLE,
      status: 'in_progress',
      state: board(3),
      stateVersion: 1,
    });
    expect(session.scoreTotal).toBe(3);
    expect(await store.get(session.id)).toEqual(session);

    await store.save(
      { gameId: EXAMPLE, status: 'completed', state: board(3), stateVersion: 1 },
      session.id,
    );
    expect(await store.get(session.id)).toBeNull();
    expect((await store.list()).items).toEqual([]);
  });

  it('keeps one campaign per game, validated by the game', async () => {
    const store = new LocalStore(memory(), ids);
    const first = await store.saveCampaign(EXAMPLE, { gamesPlayed: 1 }, 1);
    const second = await store.saveCampaign(EXAMPLE, { gamesPlayed: 2 }, 1);
    expect(second.id).toBe(first.id);
    await expect(store.saveCampaign(EXAMPLE, { gamesPlayed: -1 }, 1)).rejects.toThrow();
  });

  it('replaces the campaign with a new one when a new campaign starts', async () => {
    const store = new LocalStore(memory(), ids);
    const old = await store.saveCampaign(EXAMPLE, { gamesPlayed: 3 }, 1);
    const fresh = await store.startCampaign(EXAMPLE, { gamesPlayed: 0 }, 1);
    expect(fresh.id).not.toBe(old.id);
    expect(await store.getCampaign(EXAMPLE)).toEqual(fresh);
    await expect(store.startCampaign(EXAMPLE, { gamesPlayed: -1 }, 1)).rejects.toThrow();
    expect(await store.getCampaign(EXAMPLE)).toEqual(fresh);
  });
});

describe('flow state', () => {
  it('round-trips through storage and ignores corrupt data', () => {
    const storage = memory();
    const flow: FlowState = {
      source: 'manual',
      state: board(2),
      stateVersion: 1,
      draft: null,
      photo: null,
      corners: null,
      warnings: [],
    };
    writeFlow(storage, '_example', flow);
    expect(readFlow(storage, '_example')).toEqual(flow);
    storage.setItem('tk:v1:flow:_example', '{nope');
    expect(readFlow(storage, '_example')).toBeNull();
    clearFlow(storage, '_example');
    expect(readFlow(storage, '_example')).toBeNull();
  });
});

describe('detection meta', () => {
  it('lists the changed values of a draft and counts what was detected', () => {
    const draft = { state: board(2), confidence: { a: 0.9, b: 0.4, c: 0.8 } };
    expect(detectionMeta(draft, board(3))).toEqual({ corrected: ['cells.2'], detected: 3 });
    expect(detectionMeta(null, board(3))).toBeUndefined();
  });
});

describe('pending save', () => {
  const input = {
    gameId: '_example',
    status: 'completed' as const,
    state: board(5),
    stateVersion: 1,
  };

  it('saves after sign-in, clears itself and points at the saved game', async () => {
    const storage = memory();
    setPendingSave(storage, { input });
    const saved: SessionInput[] = [];
    const store = {
      save: (i: SessionInput) => {
        saved.push(i);
        return Promise.resolve({ id: 'abc' } as Session);
      },
    } as unknown as SessionStore;
    expect(await resumePendingSaveWith(storage, store)).toBe('/games/_example/history/abc');
    expect(saved).toHaveLength(1);
    expect(await resumePendingSaveWith(storage, store)).toBeNull();
  });

  it('keeps the result and goes back to it when saving fails', async () => {
    const storage = memory();
    setPendingSave(storage, { input });
    const store = { save: () => Promise.reject(new Error('down')) } as unknown as SessionStore;
    expect(await resumePendingSaveWith(storage, store)).toBe('/games/_example/score/result');
    expect(storage.data.size).toBe(1);
  });
});
