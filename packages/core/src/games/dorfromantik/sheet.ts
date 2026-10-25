/** The scoresheet's section E rows and the campaign sheet's unlockables (docs/games/dorfromantik.md). */

export const EXTRA_ROW_IDS = [
  'DOR-E-GOLDHEART',
  'DOR-E-BALLOON',
  'DOR-E-CONSTRUCTION',
  'DOR-E-HILL',
  'DOR-E-SHEPHERDESS',
  'DOR-E-SIGNALMAN',
  'DOR-E-CIRCUS',
  'DOR-E-REDHEARTS',
  'DOR-E-HARBOR',
  'DOR-E-TRAINSTATION',
  'DOR-E-SHIP',
  'DOR-E-LOCOMOTIVE',
  'DOR-E-WATCHTOWER',
  'DOR-E-HARVEST',
  'DOR-E-CABIN',
] as const;
export type ExtraRowId = (typeof EXTRA_ROW_IDS)[number];

export type ExtraRow = {
  id: ExtraRowId;
  label: string;
  /** The hint printed on the paper sheet. */
  hint: string;
  /** What the player enters: a count, or yes / no (Circus). */
  input: 'count' | 'yesno';
  /** What the count is of, for the input's label. */
  counts: string;
  multiplier: number;
};

/** In the paper sheet's order. */
export const EXTRA_ROWS: readonly ExtraRow[] = [
  {
    id: 'DOR-E-GOLDHEART',
    label: 'Golden Heart',
    hint: '2/matching edge',
    input: 'count',
    counts: 'Matching edges',
    multiplier: 2,
  },
  {
    id: 'DOR-E-BALLOON',
    label: 'Balloon Launch Site',
    hint: '2/distance',
    input: 'count',
    counts: 'Distance',
    multiplier: 2,
  },
  {
    id: 'DOR-E-CONSTRUCTION',
    label: 'Construction Site',
    hint: 'per territory 7+ = 7',
    input: 'count',
    counts: 'Territories of 7+ tiles',
    multiplier: 7,
  },
  {
    id: 'DOR-E-HILL',
    label: 'Hill',
    hint: 'at distance 2 = 2/Task tile',
    input: 'count',
    counts: 'Task tiles at distance 2',
    multiplier: 2,
  },
  {
    id: 'DOR-E-SHEPHERDESS',
    label: 'Shepherdess',
    hint: '1/Sheep',
    input: 'count',
    counts: 'Sheep',
    multiplier: 1,
  },
  {
    id: 'DOR-E-SIGNALMAN',
    label: 'Signalman',
    hint: '2/Grade Crossing',
    input: 'count',
    counts: 'Grade crossings',
    multiplier: 2,
  },
  {
    id: 'DOR-E-CIRCUS',
    label: 'Circus',
    hint: 'completely surrounded = 10',
    input: 'yesno',
    counts: 'Completely surrounded',
    multiplier: 10,
  },
  {
    id: 'DOR-E-REDHEARTS',
    label: 'Red Hearts',
    hint: '1/matching edge',
    input: 'count',
    counts: 'Matching edges',
    multiplier: 1,
  },
  {
    id: 'DOR-E-HARBOR',
    label: 'Harbor',
    hint: 'closed off = 1/tile',
    input: 'count',
    counts: 'Tiles',
    multiplier: 1,
  },
  {
    id: 'DOR-E-TRAINSTATION',
    label: 'Train Station',
    hint: 'closed off = 1/tile',
    input: 'count',
    counts: 'Tiles',
    multiplier: 1,
  },
  {
    id: 'DOR-E-SHIP',
    label: 'Ship',
    hint: '(task) Tasks',
    input: 'count',
    counts: 'Task marker values scored again',
    multiplier: 1,
  },
  {
    id: 'DOR-E-LOCOMOTIVE',
    label: 'Locomotive',
    hint: '(task) Tasks',
    input: 'count',
    counts: 'Task marker values scored again',
    multiplier: 1,
  },
  {
    id: 'DOR-E-WATCHTOWER',
    label: 'Watchtower',
    hint: '(task) Tasks',
    input: 'count',
    counts: 'Task marker values scored again',
    multiplier: 1,
  },
  {
    id: 'DOR-E-HARVEST',
    label: 'Harvest Festival',
    hint: '(task) Tasks',
    input: 'count',
    counts: 'Task marker values scored again',
    multiplier: 1,
  },
  {
    id: 'DOR-E-CABIN',
    label: 'Forest Cabin',
    hint: '(task) Tasks',
    input: 'count',
    counts: 'Task marker values scored again',
    multiplier: 1,
  },
];

export const UNLOCK_IDS = [
  'DOR-U-BOX1',
  'DOR-U-BOX2',
  'DOR-U-CASTLE',
  'DOR-U-CIRCUS',
  'DOR-U-CLOUDS',
  'DOR-U-DEER',
  'DOR-U-FARM',
  'DOR-U-FTUNNEL',
  'DOR-U-GTUNNEL',
  'DOR-U-HILL',
  'DOR-U-SHEPHERDESS',
  'DOR-U-SIGNALMAN',
  'DOR-U-VTUNNEL',
  'DOR-U-WAREHOUSE',
  'DOR-U-BALLOON',
  'DOR-U-CONSTRUCTION',
  'DOR-U-FLAGFEST',
  'DOR-U-CABIN',
  'DOR-U-GOLDHEART',
  'DOR-U-HARBOR',
  'DOR-U-HARVEST',
  'DOR-U-HEARTSDESIRE',
  'DOR-U-LOCOMOTIVE',
  'DOR-U-ROAD',
  'DOR-U-REDHEART',
  'DOR-U-SHIP',
  'DOR-U-TRAINSTATION',
  'DOR-U-WATCHTOWER',
] as const;
export type UnlockId = (typeof UNLOCK_IDS)[number];

export type UnlockSection = 'Advancement Track' | 'Achievements' | 'Boxes';

export type Unlockable = {
  id: UnlockId;
  name: string;
  section: UnlockSection;
  /** The scoresheet row it adds, if any. */
  row?: ExtraRowId;
};

/** In the campaign sheet's order. */
export const UNLOCKABLES: readonly Unlockable[] = [
  { id: 'DOR-U-BOX1', name: 'Open Box 1', section: 'Advancement Track' },
  { id: 'DOR-U-BOX2', name: 'Open Box 2', section: 'Advancement Track' },
  { id: 'DOR-U-CASTLE', name: 'Castle', section: 'Achievements' },
  { id: 'DOR-U-CIRCUS', name: 'Circus', section: 'Achievements', row: 'DOR-E-CIRCUS' },
  { id: 'DOR-U-CLOUDS', name: 'Clouds', section: 'Achievements' },
  { id: 'DOR-U-DEER', name: 'Deer', section: 'Achievements' },
  { id: 'DOR-U-FARM', name: 'Farm', section: 'Achievements' },
  { id: 'DOR-U-FTUNNEL', name: 'Forest Tunnel', section: 'Achievements' },
  { id: 'DOR-U-GTUNNEL', name: 'Grain Tunnel', section: 'Achievements' },
  { id: 'DOR-U-HILL', name: 'Hill', section: 'Achievements', row: 'DOR-E-HILL' },
  {
    id: 'DOR-U-SHEPHERDESS',
    name: 'Shepherdess',
    section: 'Achievements',
    row: 'DOR-E-SHEPHERDESS',
  },
  { id: 'DOR-U-SIGNALMAN', name: 'Signalman', section: 'Achievements', row: 'DOR-E-SIGNALMAN' },
  { id: 'DOR-U-VTUNNEL', name: 'Village Tunnel', section: 'Achievements' },
  { id: 'DOR-U-WAREHOUSE', name: 'Warehouse', section: 'Achievements' },
  { id: 'DOR-U-BALLOON', name: 'Balloon Launch Site', section: 'Boxes', row: 'DOR-E-BALLOON' },
  {
    id: 'DOR-U-CONSTRUCTION',
    name: 'Construction Site',
    section: 'Boxes',
    row: 'DOR-E-CONSTRUCTION',
  },
  { id: 'DOR-U-FLAGFEST', name: 'Flag Festival', section: 'Boxes' },
  { id: 'DOR-U-CABIN', name: 'Forest Cabin', section: 'Boxes', row: 'DOR-E-CABIN' },
  { id: 'DOR-U-GOLDHEART', name: 'Golden Heart', section: 'Boxes', row: 'DOR-E-GOLDHEART' },
  { id: 'DOR-U-HARBOR', name: 'Harbor', section: 'Boxes', row: 'DOR-E-HARBOR' },
  { id: 'DOR-U-HARVEST', name: 'Harvest Festival', section: 'Boxes', row: 'DOR-E-HARVEST' },
  { id: 'DOR-U-HEARTSDESIRE', name: "Heart's Desire", section: 'Boxes' },
  { id: 'DOR-U-LOCOMOTIVE', name: 'Locomotive', section: 'Boxes', row: 'DOR-E-LOCOMOTIVE' },
  { id: 'DOR-U-ROAD', name: 'On the Road to Success', section: 'Boxes' },
  { id: 'DOR-U-REDHEART', name: 'Red Hearts', section: 'Boxes', row: 'DOR-E-REDHEARTS' },
  { id: 'DOR-U-SHIP', name: 'Ship', section: 'Boxes', row: 'DOR-E-SHIP' },
  {
    id: 'DOR-U-TRAINSTATION',
    name: 'Train Station',
    section: 'Boxes',
    row: 'DOR-E-TRAINSTATION',
  },
  { id: 'DOR-U-WATCHTOWER', name: 'Watchtower', section: 'Boxes', row: 'DOR-E-WATCHTOWER' },
];

/** Wooden Red Hearts in the box (docs/games/dorfromantik.md → Campaign sheet unlockables). */
export const MAX_RED_HEARTS = 3;

export function unlockable(id: UnlockId): Unlockable {
  const found = UNLOCKABLES.find((item) => item.id === id);
  if (!found) throw new Error(`Unknown unlock ${id}`);
  return found;
}

export function extraRow(id: ExtraRowId): ExtraRow {
  const found = EXTRA_ROWS.find((row) => row.id === id);
  if (!found) throw new Error(`Unknown row ${id}`);
  return found;
}

export type Rank = { from: number; title: string; circles: number };

/** The campaign sheet's high-score table, lowest first. */
export const HIGH_SCORES: readonly Rank[] = [
  { from: 0, title: 'Vagabond', circles: 1 },
  { from: 100, title: 'Newsboy', circles: 2 },
  { from: 110, title: 'Fisherwoman', circles: 3 },
  { from: 120, title: 'Coachman', circles: 3 },
  { from: 130, title: 'Night Watchman', circles: 4 },
  { from: 140, title: 'Actress', circles: 4 },
  { from: 150, title: 'Landlady', circles: 5 },
  { from: 160, title: 'Forest Ranger', circles: 5 },
  { from: 170, title: "Farmer's Wife", circles: 6 },
  { from: 180, title: 'Engineer', circles: 6 },
  { from: 190, title: 'Ringmaster', circles: 7 },
  { from: 200, title: 'Captain', circles: 7 },
  { from: 210, title: 'Harbormaster', circles: 8 },
  { from: 220, title: 'Station Master', circles: 8 },
  { from: 230, title: 'Photographer', circles: 9 },
  { from: 240, title: 'Merchant', circles: 9 },
  { from: 250, title: 'Architect', circles: 10 },
  { from: 260, title: 'Inventor', circles: 10 },
  { from: 270, title: 'Astronomer', circles: 11 },
  { from: 280, title: 'Doctor', circles: 11 },
  { from: 290, title: 'Diplomat', circles: 12 },
  { from: 300, title: 'Balloonist', circles: 12 },
  { from: 310, title: 'Manufacturer', circles: 13 },
  { from: 320, title: 'Mayor', circles: 13 },
  { from: 330, title: 'Councilor', circles: 14 },
  { from: 340, title: 'Magnate', circles: 14 },
  { from: 350, title: 'Baroness', circles: 15 },
  { from: 375, title: 'Crown Prince', circles: 15 },
  { from: 400, title: 'Empress', circles: 15 },
];

const LOWEST: Rank = { from: 0, title: 'Vagabond', circles: 1 };

/** The total rounded down to its high-score row. */
export function rankFor(total: number): Rank {
  return HIGH_SCORES.findLast((row) => total >= row.from) ?? LOWEST;
}
