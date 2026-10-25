import type { Result } from '../../kit/types';

import type { DorfromantikCampaign, DorfromantikState } from './schema';
import {
  EXTRA_ROWS,
  MAX_RED_HEARTS,
  rankFor,
  UNLOCKABLES,
  type ExtraRow,
  type ExtraRowId,
  type Rank,
  type UnlockId,
} from './sheet';

/** Campaign helpers: docs/games/dorfromantik.md → Campaign sheet unlockables, State. */

export function initialCampaign(): DorfromantikCampaign {
  return { unlocked: [], redHearts: 0, unlockLog: [], games: [] };
}

/** DOR-E: the section E rows this campaign has unlocked, in sheet order. */
export function visibleRows(campaign: DorfromantikCampaign): ExtraRow[] {
  const unlockedRows = new Set<ExtraRowId>();
  for (const item of UNLOCKABLES) {
    if (item.row && campaign.unlocked.includes(item.id)) unlockedRows.add(item.row);
  }
  return EXTRA_ROWS.filter((row) => unlockedRows.has(row.id));
}

export function lockedRowCount(campaign: DorfromantikCampaign): number {
  return EXTRA_ROWS.length - visibleRows(campaign).length;
}

/** DOR-A: the campaign's games played + 1. */
export function nextGameNumber(campaign: DorfromantikCampaign): number {
  return campaign.games.length + 1;
}

/** A blank scoresheet for the campaign's next game. */
export function blankSheet(campaign: DorfromantikCampaign): DorfromantikState {
  return {
    gameNumber: nextGameNumber(campaign),
    tasks: { forest: 0, grain: 0, village: 0, track: 0, stream: 0 },
    flags: { green: 0, yellow: 0, red: 0 },
    longest: { track: 0, stream: 0 },
    extras: {},
  };
}

/**
 * Keeps only the section E values for rows this campaign shows, so a row locked since the
 * sheet was started never counts.
 */
export function withVisibleExtras(
  state: DorfromantikState,
  campaign: DorfromantikCampaign,
): DorfromantikState {
  const visible = new Set<string>(visibleRows(campaign).map((row) => row.id));
  // A subset of valid extras is still valid extras.
  const extras = Object.fromEntries(
    Object.entries(state.extras).filter(([id]) => visible.has(id)),
  ) as DorfromantikState['extras'];
  return { ...state, extras };
}

/** Records a saved game once per session, so a retried save doesn't count it twice. */
export function recordGame(
  campaign: DorfromantikCampaign,
  game: DorfromantikCampaign['games'][number],
): DorfromantikCampaign {
  if (campaign.games.some((g) => g.sessionId === game.sessionId)) return campaign;
  return { ...campaign, games: [...campaign.games, game] };
}

export type UnlockPicks = { ids: UnlockId[]; redHearts: number };

export type UnlockError = 'already-unlocked' | 'too-many-hearts';

/**
 * Records what a game unlocked. Each item comes once; Red Hearts come one per crossed-off
 * circle, up to 3 in all, and the first ticks its checkbox.
 */
export function addUnlocks(
  campaign: DorfromantikCampaign,
  picks: UnlockPicks,
  gameNumber: number,
): Result<DorfromantikCampaign, UnlockError> {
  const ids = picks.ids.filter((id) => id !== 'DOR-U-REDHEART');
  if (ids.some((id) => campaign.unlocked.includes(id)) || new Set(ids).size !== ids.length) {
    return { ok: false, error: 'already-unlocked' };
  }
  const redHearts = campaign.redHearts + picks.redHearts;
  if (picks.redHearts < 0 || redHearts > MAX_RED_HEARTS) {
    return { ok: false, error: 'too-many-hearts' };
  }
  const unlocked = [...campaign.unlocked, ...ids];
  if (campaign.redHearts === 0 && redHearts > 0) unlocked.push('DOR-U-REDHEART');
  const hearts = Array.from({ length: picks.redHearts }, (): UnlockId => 'DOR-U-REDHEART');
  return {
    ok: true,
    value: {
      ...campaign,
      unlocked,
      redHearts,
      unlockLog: [...campaign.unlockLog, ...[...ids, ...hearts].map((id) => ({ id, gameNumber }))],
    },
  };
}

/**
 * Takes back one logged unlock (one heart for Red Hearts). Only future sheets change: past
 * games keep their own rows in their sessions.
 */
export function undoUnlock(campaign: DorfromantikCampaign, logIndex: number): DorfromantikCampaign {
  const entry = campaign.unlockLog[logIndex];
  if (!entry) return campaign;
  const unlockLog = campaign.unlockLog.filter((_, i) => i !== logIndex);
  if (entry.id !== 'DOR-U-REDHEART') {
    return { ...campaign, unlockLog, unlocked: campaign.unlocked.filter((id) => id !== entry.id) };
  }
  const redHearts = Math.max(0, campaign.redHearts - 1);
  return {
    ...campaign,
    unlockLog,
    redHearts,
    unlocked: redHearts > 0 ? campaign.unlocked : campaign.unlocked.filter((id) => id !== entry.id),
  };
}

export type CampaignSummary = {
  gamesPlayed: number;
  /** The best game total; null before the first game. */
  highScore: number | null;
  /** The high score's row in the high-score table; null before the first game. */
  rank: Rank | null;
};

export function campaignSummary(campaign: DorfromantikCampaign): CampaignSummary {
  const totals = campaign.games.map((game) => game.total);
  const highScore = totals.length > 0 ? Math.max(...totals) : null;
  return {
    gamesPlayed: campaign.games.length,
    highScore,
    rank: highScore === null ? null : rankFor(highScore),
  };
}
