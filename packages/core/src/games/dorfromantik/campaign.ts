import type { DorfromantikCampaign, DorfromantikState } from './schema';
import { EXTRA_ROWS, UNLOCKABLES, type ExtraRow, type ExtraRowId } from './sheet';

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
