import type { CellRef, ScoreBreakdown, ScoreCategory } from './types';

/** One breakdown row; optional fields are left out rather than set to undefined. */
export function category(
  key: string,
  label: string,
  points: number,
  extra: { highlights?: CellRef[]; note?: string } = {},
): ScoreCategory {
  return {
    key,
    label,
    points,
    ...(extra.highlights && extra.highlights.length > 0 ? { highlights: extra.highlights } : {}),
    ...(extra.note ? { note: extra.note } : {}),
  };
}

/** A breakdown whose total is the sum of its categories. */
export function buildBreakdown(categories: ScoreCategory[]): ScoreBreakdown {
  return { total: sumCategories(categories), categories };
}

export function sumCategories(categories: readonly ScoreCategory[]): number {
  return categories.reduce((sum, row) => sum + row.points, 0);
}
