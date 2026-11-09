import type { PlanningCard } from "./types";

export interface CardFilters {
  q: string;
  onlyMine: boolean;
  /** Assignee ids; "none" = unassigned. Empty = everyone. */
  assignees: string[];
  /** Issue types (base type, or "custom:<name>"). Empty = all. */
  types: string[];
  /** Epic ids; "none" = no epic. Empty = all. */
  epics: string[];
  /** Only issues updated in the last 24 hours. */
  recent: boolean;
}

export const EMPTY_FILTERS: CardFilters = {
  q: "",
  onlyMine: false,
  assignees: [],
  types: [],
  epics: [],
  recent: false,
};

const DAY = 86_400_000;

/** The type value a card filters by: its custom type, or its base type. */
export const cardTypeValue = (card: PlanningCard) =>
  card.customType ? `custom:${card.customType.name}` : card.type;

export function matchesFilters(
  card: PlanningCard,
  filters: CardFilters,
  currentUserId: string,
  now = Date.now(),
): boolean {
  if (filters.types.length && !filters.types.includes(cardTypeValue(card))) return false;
  if (filters.epics.length) {
    const epic = card.parent?.type === "epic" ? card.parent.id : "none";
    if (!filters.epics.includes(epic)) return false;
  }
  if (filters.recent && now - new Date(card.updatedAt).getTime() > DAY) return false;
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
  Boolean(
    f.q.trim() || f.onlyMine || f.assignees.length || f.types.length || f.epics.length || f.recent,
  );

/** Type and epic choices for the filter bar, from the cards on screen. */
export function filterOptionsFor(cards: PlanningCard[], typeLabel: (card: PlanningCard) => string) {
  const types = new Map<string, string>();
  const epics = new Map<string, string>();
  let noEpic = false;
  for (const card of cards) {
    types.set(cardTypeValue(card), typeLabel(card));
    if (card.parent?.type === "epic")
      epics.set(card.parent.id, `${card.parent.key} ${card.parent.title}`);
    else noEpic = true;
  }
  const sorted = (m: Map<string, string>) =>
    [...m]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  return {
    typeOptions: sorted(types),
    epicOptions: [
      ...sorted(epics),
      ...(noEpic && epics.size ? [{ value: "none", label: "No epic" }] : []),
    ],
  };
}
