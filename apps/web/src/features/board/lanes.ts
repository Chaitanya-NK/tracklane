import { ALLOWED_PARENT_TYPES, PRIORITIES, PRIORITY_LABELS, type Priority } from "@tracklane/core";
import type { Columns } from "./columns";
import type { BoardColumn, PlanningCard } from "./types";

export const LANE_GROUPINGS = ["none", "assignee", "epic", "priority"] as const;
export type LaneGrouping = (typeof LANE_GROUPINGS)[number];

export const LANE_GROUPING_LABELS: Record<LaneGrouping, string> = {
  none: "No swimlanes",
  assignee: "Assignee",
  epic: "Epic",
  priority: "Priority",
};

/** The field change a drop into a lane implies. */
export type LanePatch =
  | { assigneeId: string | null }
  | { priority: Priority }
  | { parentId: string | null }
  | Record<string, never>;

export interface Lane {
  id: string;
  title: string;
  /** For avatars / icons in the lane header. */
  assignee?: { id: string; name: string; image: string | null };
  priority?: Priority;
  epicKey?: string;
  patch: LanePatch;
}

const NONE = "none";
const SEP = "::";

export const cellId = (laneId: string, statusId: string) => `${laneId}${SEP}${statusId}`;
export function parseCellId(id: string): { laneId: string; statusId: string } | null {
  const at = id.indexOf(SEP);
  if (at < 0) return null;
  return { laneId: id.slice(0, at), statusId: id.slice(at + SEP.length) };
}

function laneIdOf(card: PlanningCard, by: LaneGrouping): string {
  switch (by) {
    case "none":
      return "all";
    case "assignee":
      return card.assignee?.id ?? NONE;
    case "priority":
      return card.priority;
    case "epic":
      return card.parent?.type === "epic" ? card.parent.id : NONE;
  }
}

/** Lanes for the cards, in display order. The "none" lane comes last. */
export function lanesFor(cards: PlanningCard[], by: LaneGrouping): Lane[] {
  switch (by) {
    case "none":
      return [{ id: "all", title: "All issues", patch: {} }];
    case "priority":
      // Every priority, so cards can be dropped into an empty one.
      return [...PRIORITIES].reverse().map((p) => ({
        id: p,
        title: PRIORITY_LABELS[p],
        priority: p,
        patch: { priority: p },
      }));
    case "assignee": {
      const people = new Map<string, NonNullable<PlanningCard["assignee"]>>();
      for (const card of cards) if (card.assignee) people.set(card.assignee.id, card.assignee);
      return [
        ...[...people.values()]
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((a) => ({ id: a.id, title: a.name, assignee: a, patch: { assigneeId: a.id } })),
        { id: NONE, title: "Unassigned", patch: { assigneeId: null } },
      ];
    }
    case "epic": {
      const epics = new Map<string, NonNullable<PlanningCard["parent"]>>();
      for (const card of cards)
        if (card.parent?.type === "epic") epics.set(card.parent.id, card.parent);
      return [
        ...[...epics.values()]
          .sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true }))
          .map((e) => ({ id: e.id, title: e.title, epicKey: e.key, patch: { parentId: e.id } })),
        { id: NONE, title: "No epic", patch: { parentId: null } },
      ];
    }
  }
}

/** Cell id → card ids in rank order, with an entry for every lane × status. */
export function cellsFrom(
  columns: BoardColumn[],
  lanes: Lane[],
  cards: PlanningCard[],
  by: LaneGrouping,
): Columns {
  const cells: Columns = {};
  for (const lane of lanes) for (const column of columns) cells[cellId(lane.id, column.id)] = [];
  for (const card of cards) cells[cellId(laneIdOf(card, by), card.statusId)]?.push(card.id);
  return cells;
}

/**
 * Why a card can't go into a lane, or null if it can. Subtasks keep their story/task parent, so
 * they can't be moved between epics.
 */
export function laneProblem(card: PlanningCard, lane: Lane, by: LaneGrouping): string | null {
  if (by !== "epic" || laneIdOf(card, by) === lane.id) return null;
  if (card.parent && card.parent.type !== "epic")
    return `${card.key} belongs to ${card.parent.key}`;
  if (lane.id !== NONE && !ALLOWED_PARENT_TYPES[card.type].includes("epic")) {
    return `A ${card.type} can't be in an epic`;
  }
  return null;
}

/** The lane's field change, if the card is changing lanes. */
export function lanePatchFor(card: PlanningCard, lane: Lane, by: LaneGrouping): LanePatch {
  return laneIdOf(card, by) === lane.id ? {} : lane.patch;
}
