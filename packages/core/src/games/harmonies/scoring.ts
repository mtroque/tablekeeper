import { buildBreakdown, category } from '../../kit/breakdown';
import {
  hexComponents,
  hexDiameter,
  hexKey,
  hexNeighbors,
  hexRef,
  parseHexKey,
} from '../../kit/hex-grid';
import type { CellRef, ScoreBreakdown, ScoreCategory } from '../../kit/types';

import { HARMONIES_LAYOUTS } from './layout';
import { isHarmoniesBuilding, isHarmoniesMountain, stackCode, type HarmoniesPiece } from './stacks';
import type { HarmoniesState } from './state';

/** `HAR-TREE-1`. */
const TREE_POINTS: Record<string, number> = { L: 1, TL: 3, TTL: 7 };
/** `HAR-MTN-1`, by height. */
const MOUNTAIN_POINTS = [0, 1, 3, 7];
/** `HAR-WATER-A-2`, by river length up to 6. */
const RIVER_POINTS = [0, 0, 2, 5, 8, 11, 15];

const FIELD_GROUP_POINTS = 5;
const BUILDING_POINTS = 5;
const ISLAND_POINTS = 5;

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** `HAR-WATER-A-2`: 4 more for each space beyond 6. */
export function harmoniesRiverPoints(length: number): number {
  if (length <= 6) return RIVER_POINTS[length] ?? 0;
  return 15 + (length - 6) * 4;
}

const refOf = (key: string): CellRef => {
  const { q, r } = parseHexKey(key);
  return hexRef(q, r);
};

/** docs/games/harmonies.md → Scoring rules. Pure; the API recomputes with it. */
export function scoreHarmonies(state: HarmoniesState): ScoreBreakdown {
  const layout = HARMONIES_LAYOUTS[state.side];
  const stacks = new Map<string, HarmoniesPiece[]>(
    layout.cells.flatMap(({ q, r }) => {
      const key = hexKey(q, r);
      const stack = state.stacks[key];
      return stack && stack.length > 0 ? [[key, stack] as const] : [];
    }),
  );
  const top = (key: string): HarmoniesPiece | undefined => stacks.get(key)?.at(-1);
  const keysWhere = (test: (stack: HarmoniesPiece[]) => boolean) =>
    [...stacks].filter(([, stack]) => test(stack)).map(([key]) => key);

  // HAR-TREE-1
  const trees = keysWhere((stack) => stackCode(stack) in TREE_POINTS);
  const treePoints = trees.reduce(
    (sum, key) => sum + (TREE_POINTS[stackCode(stacks.get(key) ?? [])] ?? 0),
    0,
  );

  // HAR-MTN-1, HAR-MTN-2
  const mountains = keysWhere(isHarmoniesMountain);
  const mountainSet = new Set(mountains);
  const scoringMountains = mountains.filter((key) =>
    hexNeighbors(layout, key).some((neighbor) => mountainSet.has(neighbor)),
  );
  const mountainPoints = scoringMountains.reduce(
    (sum, key) => sum + (MOUNTAIN_POINTS[stacks.get(key)?.length ?? 0] ?? 0),
    0,
  );

  const alone = mountains.length - scoringMountains.length;

  // HAR-FIELD-1
  const fieldGroups = hexComponents(
    layout,
    keysWhere((stack) => stackCode(stack) === 'F'),
  ).filter((group) => group.length >= 2);

  // HAR-BLD-1
  const buildings = keysWhere(isHarmoniesBuilding);
  const scoringBuildings = buildings.filter((key) => {
    const colors = new Set(hexNeighbors(layout, key).flatMap((n) => top(n) ?? []));
    return colors.size >= 3;
  });

  const categories: ScoreCategory[] = [
    category('trees', 'Trees', treePoints, {
      highlights: trees.map(refOf),
      ...(trees.length > 0 ? { note: `${plural(trees.length, 'tree', 'trees')}.` } : {}),
    }),
    category('mountains', 'Mountains', mountainPoints, {
      highlights: scoringMountains.map(refOf),
      ...(alone > 0
        ? {
            note:
              alone === 1
                ? '1 mountain has no mountain next to it and scores 0.'
                : `${alone} mountains have no mountain next to them and score 0.`,
          }
        : {}),
    }),
    category('fields', 'Fields', fieldGroups.length * FIELD_GROUP_POINTS, {
      highlights: fieldGroups.flat().map(refOf),
      ...(fieldGroups.length > 0
        ? { note: `${plural(fieldGroups.length, 'group', 'groups')} of 2 or more fields.` }
        : {}),
    }),
    category('buildings', 'Buildings', scoringBuildings.length * BUILDING_POINTS, {
      highlights: scoringBuildings.map(refOf),
      ...(buildings.length > 0
        ? {
            note: `${scoringBuildings.length} of ${plural(buildings.length, 'building', 'buildings')} next to 3 or more colors.`,
          }
        : {}),
    }),
    state.side === 'A' ? riverCategory(state, stacks) : islandCategory(state, stacks),
    category(
      'animals',
      'Animal Cards',
      state.animalCards.reduce((sum, card) => sum + card.points, 0),
      state.animalCards.length > 0
        ? { note: `${plural(state.animalCards.length, 'card', 'cards')}.` }
        : {},
    ),
  ];

  // HAR-SPIRIT-1: optional, so only shown when used.
  const spirits = state.spiritCards ?? [];
  if (spirits.length > 0) {
    categories.push(
      category(
        'spirits',
        "Nature's Spirit",
        spirits.reduce((sum, card) => sum + card.points, 0),
        { note: `${plural(spirits.length, 'card', 'cards')}.` },
      ),
    );
  }

  // HAR-TOTAL-1
  return buildBreakdown(categories);
}

/** `HAR-WATER-A-1`, `HAR-WATER-A-2`: only the longest river scores. */
function riverCategory(
  state: HarmoniesState,
  stacks: Map<string, HarmoniesPiece[]>,
): ScoreCategory {
  const layout = HARMONIES_LAYOUTS[state.side];
  const water = [...stacks].filter(([, stack]) => stackCode(stack) === 'W').map(([key]) => key);
  let longest: string[] = [];
  let length = 0;
  for (const river of hexComponents(layout, water)) {
    const riverLength = hexDiameter(layout, river);
    if (riverLength > length) {
      longest = river;
      length = riverLength;
    }
  }
  return category('water', 'Water', harmoniesRiverPoints(length), {
    highlights: longest.map(refOf),
    ...(length > 0 ? { note: `Longest river: ${plural(length, 'space', 'spaces')}.` } : {}),
  });
}

/** `HAR-WATER-B-1`: every island scores; empty spaces are land; always at least 1 island. */
function islandCategory(
  state: HarmoniesState,
  stacks: Map<string, HarmoniesPiece[]>,
): ScoreCategory {
  const layout = HARMONIES_LAYOUTS[state.side];
  const land = layout.cells
    .map(({ q, r }) => hexKey(q, r))
    .filter((key) => stackCode(stacks.get(key) ?? []) !== 'W');
  const islands = Math.max(1, hexComponents(layout, land).length);
  return category('water', 'Water', islands * ISLAND_POINTS, {
    highlights: land.map(refOf),
    note: `${plural(islands, 'island', 'islands')}.`,
  });
}
