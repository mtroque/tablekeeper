import { describe, expect, it } from 'vitest';

import { parseState } from '../../kit/state';
import { getGame } from '../registry';

import {
  blankSheet,
  dorfromantik,
  DorfromantikCampaignSchema,
  EXTRA_ROWS,
  initialCampaign,
  lockedRowCount,
  nextGameNumber,
  rankFor,
  recordGame,
  scoreDorfromantik,
  subtotals,
  UNLOCKABLES,
  visibleRows,
  withVisibleExtras,
  type DorfromantikCampaign,
  type DorfromantikState,
} from '.';

function sheet(patch: Partial<DorfromantikState> = {}): DorfromantikState {
  return { ...blankSheet(initialCampaign()), ...patch };
}

function campaignWith(unlocked: DorfromantikCampaign['unlocked'], redHearts = 0) {
  return { ...initialCampaign(), unlocked, redHearts };
}

/** The rulebook example: tasks total 42, yellow flag 5, longest track 8, longest stream 5. */
const RULEBOOK_EXAMPLE = sheet({
  tasks: { forest: 10, grain: 6, village: 12, track: 4, stream: 10 },
  flags: { green: 0, yellow: 5, red: 0 },
  longest: { track: 8, stream: 5 },
});

describe('dorfromantik scoresheet', () => {
  it('DOR-S1, DOR-S2, DOR-H: the rulebook example totals 60', () => {
    expect(subtotals(RULEBOOK_EXAMPLE)).toEqual({
      tasks: 42,
      flagsLongest: 18,
      unlocked: 0,
      total: 60,
    });
    const breakdown = scoreDorfromantik(RULEBOOK_EXAMPLE);
    expect(breakdown.total).toBe(60);
    expect(breakdown.categories.map((c) => [c.key, c.points])).toEqual([
      ['tasks', 42],
      ['flags-longest', 18],
    ]);
  });

  it('DOR-B1..B5: task points are the per-type sums as entered', () => {
    const state = sheet({ tasks: { forest: 4, grain: 5, village: 6, track: 7, stream: 11 } });
    expect(subtotals(state).tasks).toBe(33);
    expect(scoreDorfromantik(state).categories[0]?.note).toBe(
      'Forest 4, grain 5, village 6, track 7, stream 11.',
    );
  });

  it('DOR-C1..C3, DOR-D1, DOR-D2: flags and longest add as entered', () => {
    const state = sheet({
      flags: { green: 3, yellow: 4, red: 5 },
      longest: { track: 6, stream: 7 },
    });
    expect(subtotals(state).flagsLongest).toBe(25);
  });

  it('DOR-E-CIRCUS: surrounded scores 10, not surrounded 0', () => {
    expect(subtotals(sheet({ extras: { 'DOR-E-CIRCUS': true } })).unlocked).toBe(10);
    expect(subtotals(sheet({ extras: { 'DOR-E-CIRCUS': false } })).unlocked).toBe(0);
  });

  it('DOR-E-REDHEARTS: 6 matching edges score 6', () => {
    const breakdown = scoreDorfromantik(sheet({ extras: { 'DOR-E-REDHEARTS': 6 } }));
    expect(breakdown.total).toBe(6);
    expect(breakdown.categories[2]).toMatchObject({
      key: 'unlocked',
      label: 'Unlocked Components',
      points: 6,
      note: 'Red Hearts 6.',
    });
  });

  it('DOR-E, DOR-S3: every row scores count × its multiplier', () => {
    const expected: Record<string, number> = {
      'DOR-E-GOLDHEART': 2,
      'DOR-E-BALLOON': 2,
      'DOR-E-CONSTRUCTION': 7,
      'DOR-E-HILL': 2,
      'DOR-E-SHEPHERDESS': 1,
      'DOR-E-SIGNALMAN': 2,
      'DOR-E-REDHEARTS': 1,
      'DOR-E-HARBOR': 1,
      'DOR-E-TRAINSTATION': 1,
      'DOR-E-SHIP': 1,
      'DOR-E-LOCOMOTIVE': 1,
      'DOR-E-WATCHTOWER': 1,
      'DOR-E-HARVEST': 1,
      'DOR-E-CABIN': 1,
    };
    for (const row of EXTRA_ROWS) {
      if (row.input === 'yesno') continue;
      expect(subtotals(sheet({ extras: { [row.id]: 3 } })).unlocked, row.id).toBe(
        3 * (expected[row.id] ?? NaN),
      );
    }
    const all = sheet({
      extras: { 'DOR-E-CONSTRUCTION': 2, 'DOR-E-SHIP': 5, 'DOR-E-CIRCUS': true },
    });
    expect(subtotals(all)).toMatchObject({ unlocked: 29, total: 29 });
  });

  it('DOR-A: the game number is games played + 1, and is required', () => {
    const played = recordGame(initialCampaign(), {
      sessionId: '00000000-0000-4000-8000-000000000001',
      gameNumber: 1,
      total: 60,
    });
    expect(nextGameNumber(initialCampaign())).toBe(1);
    expect(nextGameNumber(played)).toBe(2);
    expect(blankSheet(played).gameNumber).toBe(2);
    expect(parseState(dorfromantik, { ...sheet(), gameNumber: 0 }, 0).ok).toBe(false);
  });

  it('DOR-F: player names are optional', () => {
    expect(parseState(dorfromantik, sheet(), 0).ok).toBe(true);
    expect(parseState(dorfromantik, { ...sheet(), players: ['Ana', 'Ben'] }, 0).ok).toBe(true);
    expect(parseState(dorfromantik, { ...sheet(), players: [''] }, 0).ok).toBe(false);
  });

  it('rejects negative counts, unknown rows and a numeric Circus', () => {
    const bad = [
      { ...sheet(), tasks: { ...sheet().tasks, forest: -1 } },
      { ...sheet(), extras: { 'DOR-E-NOPE': 1 } },
      { ...sheet(), extras: { 'DOR-E-CIRCUS': 10 } },
      { ...sheet(), extras: { 'DOR-E-SHIP': true } },
    ];
    for (const state of bad) expect(parseState(dorfromantik, state, 0).ok).toBe(false);
  });

  it('is the registered game, with a scorer and a campaign', () => {
    expect(getGame('dorfromantik')).toBe(dorfromantik);
    expect(dorfromantik.score?.(dorfromantik.initialState()).total).toBe(0);
    expect(dorfromantik.campaign?.initialState()).toEqual(initialCampaign());
  });
});

describe('dorfromantik high-score table', () => {
  it.each([
    [128, 'Coachman', 3],
    [142, 'Actress', 4],
    [99, 'Vagabond', 1],
    [0, 'Vagabond', 1],
    [100, 'Newsboy', 2],
    [374, 'Baroness', 15],
    [512, 'Empress', 15],
  ])('a total of %i rounds down to %s, %i circles', (total, title, circles) => {
    expect(rankFor(total)).toMatchObject({ title, circles });
  });
});

describe('dorfromantik campaign', () => {
  it('DOR-E: a new campaign shows no section E rows; unlocking Circus adds the Circus row', () => {
    expect(visibleRows(initialCampaign())).toEqual([]);
    expect(lockedRowCount(initialCampaign())).toBe(15);
    const circus = campaignWith(['DOR-U-CIRCUS']);
    expect(visibleRows(circus).map((row) => row.id)).toEqual(['DOR-E-CIRCUS']);
    expect(lockedRowCount(circus)).toBe(14);
  });

  it('DOR-U: unlocks without a row add none, and rows keep sheet order', () => {
    const campaign = campaignWith(
      ['DOR-U-REDHEART', 'DOR-U-CASTLE', 'DOR-U-BOX1', 'DOR-U-GOLDHEART'],
      1,
    );
    expect(visibleRows(campaign).map((row) => row.id)).toEqual([
      'DOR-E-GOLDHEART',
      'DOR-E-REDHEARTS',
    ]);
  });

  it('DOR-U: every row is added by exactly one unlockable', () => {
    for (const row of EXTRA_ROWS) {
      expect(
        UNLOCKABLES.filter((item) => item.row === row.id),
        row.id,
      ).toHaveLength(1);
    }
  });

  it('drops values for rows the campaign no longer shows', () => {
    const state = sheet({ extras: { 'DOR-E-CIRCUS': true, 'DOR-E-HILL': 2 } });
    expect(withVisibleExtras(state, campaignWith(['DOR-U-HILL'])).extras).toEqual({
      'DOR-E-HILL': 2,
    });
  });

  it('records a game once per session', () => {
    const game = { sessionId: '00000000-0000-4000-8000-000000000002', gameNumber: 1, total: 60 };
    const once = recordGame(initialCampaign(), game);
    expect(recordGame(once, game)).toBe(once);
    expect(once.games).toEqual([game]);
  });

  it('DOR-U-REDHEART: 0 to 3 hearts, unlocked exactly when there is one', () => {
    const parse = (c: unknown) => DorfromantikCampaignSchema.safeParse(c).success;
    expect(parse(campaignWith(['DOR-U-REDHEART'], 3))).toBe(true);
    expect(parse(campaignWith(['DOR-U-REDHEART'], 4))).toBe(false);
    expect(parse(campaignWith(['DOR-U-REDHEART'], 0))).toBe(false);
    expect(parse(campaignWith([], 1))).toBe(false);
    expect(parse(campaignWith(['DOR-U-CIRCUS', 'DOR-U-CIRCUS']))).toBe(false);
  });
});
