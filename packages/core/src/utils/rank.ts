/** Gap between consecutive ranks after renumbering, and for items appended at the end. */
export const RANK_STEP = 1000;
/** Below this gap, midpoints lose precision and the list is renumbered. */
const MIN_GAP = 1e-6;

/**
 * Rank for an item dropped between two neighbours (either may be missing at the ends).
 * Returns null when the neighbours are too close: renumber the list, then call again.
 */
export function rankBetween(
  before: number | null | undefined,
  after: number | null | undefined,
): number | null {
  const hasBefore = typeof before === "number";
  const hasAfter = typeof after === "number";
  if (!hasBefore && !hasAfter) return RANK_STEP;
  if (!hasBefore) return after! - RANK_STEP;
  if (!hasAfter) return before + RANK_STEP;
  if (after! - before < MIN_GAP * 2) return null;
  return before + (after! - before) / 2;
}

/** Evenly spaced ranks for `count` items, used when renumbering. */
export function evenRanks(count: number): number[] {
  return Array.from({ length: count }, (_, i) => (i + 1) * RANK_STEP);
}
