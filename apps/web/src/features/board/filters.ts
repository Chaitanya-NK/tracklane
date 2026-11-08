import type { PlanningCard } from "./types";

export interface CardFilters {
  q: string;
  onlyMine: boolean;
  /** Assignee ids; "none" = unassigned. Empty = everyone. */
  assignees: string[];
}

export const EMPTY_FILTERS: CardFilters = { q: "", onlyMine: false, assignees: [] };

export function matchesFilters(
  card: PlanningCard,
  filters: CardFilters,
  currentUserId: string,
): boolean {
  if (filters.onlyMine && card.assignee?.id !== currentUserId) return false;
  if (filters.assignees.length) {
    const id = card.assignee?.id ?? "none";
    if (!filters.assignees.includes(id)) return false;
  }
  const q = filters.q.trim().toLowerCase();
  if (q && !card.title.toLowerCase().includes(q) && !card.key.toLowerCase().includes(q))
    return false;
  return true;
}

export const isFiltering = (f: CardFilters) =>
  Boolean(f.q.trim() || f.onlyMine || f.assignees.length);
