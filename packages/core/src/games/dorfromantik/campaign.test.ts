import { describe, expect, it } from 'vitest';

import {
  addUnlocks,
  campaignSummary,
  DorfromantikCampaignSchema,
  initialCampaign,
  recordGame,
  undoUnlock,
  visibleRows,
  type DorfromantikCampaign,
} from '.';

function unlocked(result: ReturnType<typeof addUnlocks>): DorfromantikCampaign {
  if (!result.ok) throw new Error(result.error);
  // Every result must still be a valid stored campaign.
  return DorfromantikCampaignSchema.parse(result.value);
}

describe('dorfromantik unlocks', () => {
  it('DOR-U: logs each unlock with its game and adds its row', () => {
    const campaign = unlocked(
      addUnlocks(initialCampaign(), { ids: ['DOR-U-BOX1', 'DOR-U-CIRCUS'], redHearts: 0 }, 3),
    );
    expect(campaign.unlocked).toEqual(['DOR-U-BOX1', 'DOR-U-CIRCUS']);
    expect(campaign.unlockLog).toEqual([
      { id: 'DOR-U-BOX1', gameNumber: 3 },
      { id: 'DOR-U-CIRCUS', gameNumber: 3 },
    ]);
    expect(visibleRows(campaign).map((row) => row.id)).toEqual(['DOR-E-CIRCUS']);
  });

  it('DOR-U: an item can be unlocked only once', () => {
    const campaign = unlocked(
      addUnlocks(initialCampaign(), { ids: ['DOR-U-HILL'], redHearts: 0 }, 1),
    );
    expect(addUnlocks(campaign, { ids: ['DOR-U-HILL'], redHearts: 0 }, 2)).toEqual({
      ok: false,
      error: 'already-unlocked',
    });
    expect(
      addUnlocks(initialCampaign(), { ids: ['DOR-U-HILL', 'DOR-U-HILL'], redHearts: 0 }, 1).ok,
    ).toBe(false);
  });

  it('DOR-U-REDHEART: hearts come 1 to 3 across games, the first ticks the checkbox', () => {
    const one = unlocked(addUnlocks(initialCampaign(), { ids: [], redHearts: 1 }, 1));
    expect(one.unlocked).toEqual(['DOR-U-REDHEART']);
    expect(visibleRows(one).map((row) => row.id)).toEqual(['DOR-E-REDHEARTS']);
    const three = unlocked(addUnlocks(one, { ids: [], redHearts: 2 }, 4));
    expect(three.redHearts).toBe(3);
    expect(three.unlocked).toEqual(['DOR-U-REDHEART']);
    expect(three.unlockLog.map((entry) => entry.gameNumber)).toEqual([1, 4, 4]);
  });

  it('DOR-U-REDHEART: Red Hearts can be unlocked at most 3 times', () => {
    const three = unlocked(addUnlocks(initialCampaign(), { ids: [], redHearts: 3 }, 1));
    expect(addUnlocks(three, { ids: [], redHearts: 1 }, 2)).toEqual({
      ok: false,
      error: 'too-many-hearts',
    });
    expect(addUnlocks(initialCampaign(), { ids: [], redHearts: 4 }, 1).ok).toBe(false);
  });

  it('undo takes back one unlock and its row; past games are untouched', () => {
    const played = recordGame(initialCampaign(), {
      sessionId: '00000000-0000-4000-8000-000000000001',
      gameNumber: 1,
      total: 70,
    });
    const campaign = unlocked(addUnlocks(played, { ids: ['DOR-U-CIRCUS'], redHearts: 0 }, 1));
    const undone = DorfromantikCampaignSchema.parse(undoUnlock(campaign, 0));
    expect(undone.unlocked).toEqual([]);
    expect(visibleRows(undone)).toEqual([]);
    expect(undone.games).toEqual(played.games);
  });

  it('undo takes back one heart at a time, and the row goes with the last', () => {
    const two = unlocked(addUnlocks(initialCampaign(), { ids: [], redHearts: 2 }, 1));
    const one = DorfromantikCampaignSchema.parse(undoUnlock(two, 1));
    expect(one).toMatchObject({ redHearts: 1, unlocked: ['DOR-U-REDHEART'] });
    const none = DorfromantikCampaignSchema.parse(undoUnlock(one, 0));
    expect(none).toMatchObject({ redHearts: 0, unlocked: [], unlockLog: [] });
    expect(undoUnlock(none, 5)).toBe(none);
  });
});

describe('dorfromantik campaign summary', () => {
  it('has no high score before the first game', () => {
    expect(campaignSummary(initialCampaign())).toEqual({
      gamesPlayed: 0,
      highScore: null,
      rank: null,
    });
  });

  it('ranks the best game: 142 points is Actress, 4 circles', () => {
    let campaign = initialCampaign();
    [128, 142, 99].forEach((total, i) => {
      campaign = recordGame(campaign, {
        sessionId: `00000000-0000-4000-8000-00000000000${i}`,
        gameNumber: i + 1,
        total,
      });
    });
    expect(campaignSummary(campaign)).toEqual({
      gamesPlayed: 3,
      highScore: 142,
      rank: { from: 140, title: 'Actress', circles: 4 },
    });
  });
});
