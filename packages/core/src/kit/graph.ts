/**
 * Breadth-first search over cells named by string keys. The square and hex grids supply
 * the neighbor function; everything here is shape-agnostic.
 */
export type Neighbors = (key: string) => readonly string[];

/** Shortest-path distance in steps from `start` to every cell of `cells` it can reach. */
export function distancesFrom(
  start: string,
  cells: ReadonlySet<string>,
  neighbors: Neighbors,
): Map<string, number> {
  const distances = new Map<string, number>();
  if (!cells.has(start)) return distances;
  distances.set(start, 0);
  const queue = [start];
  for (let i = 0; i < queue.length; i++) {
    const key = queue[i] as string;
    const next = (distances.get(key) ?? 0) + 1;
    for (const neighbor of neighbors(key)) {
      if (!cells.has(neighbor) || distances.has(neighbor)) continue;
      distances.set(neighbor, next);
      queue.push(neighbor);
    }
  }
  return distances;
}

/** Groups of connected cells, each in breadth-first order from its first cell in `cells`. */
export function connectedComponents(cells: Iterable<string>, neighbors: Neighbors): string[][] {
  const set = new Set(cells);
  const seen = new Set<string>();
  const groups: string[][] = [];
  for (const key of set) {
    if (seen.has(key)) continue;
    const group = [...distancesFrom(key, set, neighbors).keys()];
    for (const member of group) seen.add(member);
    groups.push(group);
  }
  return groups;
}

/**
 * The greatest shortest-path distance between two cells of a connected group, counted in
 * cells with both ends included: 1 for a single cell, 0 for none. Cells the group can't
 * reach from its first cell are ignored, so pass one connected component.
 */
export function groupDiameter(group: Iterable<string>, neighbors: Neighbors): number {
  const set = new Set(group);
  let longest = 0;
  for (const key of set) {
    for (const steps of distancesFrom(key, set, neighbors).values()) {
      longest = Math.max(longest, steps + 1);
    }
  }
  return longest;
}
