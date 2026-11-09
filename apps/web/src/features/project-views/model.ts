import {
  ISSUE_TYPE_LABELS,
  type IssueType,
  PRIORITIES,
  PRIORITY_LABELS,
  type Priority,
  type StatusCategory,
} from "@tracklane/core";
import type { IssueFilters } from "@/features/issues";

/** One issue as the project list shows it. Dates are ISO strings (client-safe). */
export interface ListRow {
  id: string;
  key: string;
  title: string;
  type: IssueType;
  customType: { name: string; color: string; icon: string } | null;
  priority: Priority;
  status: { id: string; name: string; category: StatusCategory };
  assignee: { id: string; name: string; image: string | null } | null;
  labels: { id: string; name: string; color: string }[];
  estimate: number | null;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  epic: { key: string; title: string } | null;
  sprint: { id: string; name: string } | null;
  /** Custom field id → display value (select option label or person's name). */
  fields: Record<string, string>;
}

export const LIST_COLUMNS = [
  { id: "status", label: "Status" },
  { id: "assignee", label: "Assignee" },
  { id: "priority", label: "Priority" },
  { id: "type", label: "Type" },
  { id: "epic", label: "Epic" },
  { id: "sprint", label: "Sprint" },
  { id: "labels", label: "Labels" },
  { id: "points", label: "Points" },
  { id: "due", label: "Due" },
  { id: "updated", label: "Updated" },
  { id: "created", label: "Created" },
] as const;
export type ListColumn = (typeof LIST_COLUMNS)[number]["id"];
export const DEFAULT_LIST_COLUMNS: ListColumn[] = [
  "status",
  "assignee",
  "priority",
  "due",
  "updated",
];

export interface GroupableField {
  id: string;
  name: string;
}

export const BASE_GROUPS = [
  "none",
  "status",
  "assignee",
  "priority",
  "type",
  "epic",
  "sprint",
] as const;
export type GroupBy = (typeof BASE_GROUPS)[number] | `field:${string}`;

export const GROUP_LABELS: Record<(typeof BASE_GROUPS)[number], string> = {
  none: "No grouping",
  status: "Status",
  assignee: "Assignee",
  priority: "Priority",
  type: "Type",
  epic: "Epic",
  sprint: "Sprint",
};

export function parseGroupBy(value: string | undefined, fields: GroupableField[]): GroupBy {
  if (!value) return "none";
  if ((BASE_GROUPS as readonly string[]).includes(value)) return value as GroupBy;
  if (value.startsWith("field:") && fields.some((f) => `field:${f.id}` === value))
    return value as GroupBy;
  return "none";
}

export interface RowGroup {
  key: string;
  label: string;
  rows: ListRow[];
  points: number;
}

const NONE = "\u0000none";

/**
 * Groups rows, keeping each group's row order. Groups follow a natural order (workflow order
 * for status, highest priority first…) with "No …" groups last.
 */
export function groupRows(
  rows: ListRow[],
  groupBy: GroupBy,
  ctx: { statusOrder: string[] },
): RowGroup[] {
  if (groupBy === "none") {
    return [{ key: "all", label: "All issues", rows, points: sumPoints(rows) }];
  }
  const groups = new Map<string, RowGroup>();
  const fieldId = groupBy.startsWith("field:") ? groupBy.slice(6) : null;

  for (const row of rows) {
    let key: string;
    let label: string;
    if (fieldId) {
      const value = row.fields[fieldId];
      key = value ?? NONE;
      label = value ?? "No value";
    } else {
      switch (groupBy) {
        case "status":
          key = row.status.id;
          label = row.status.name;
          break;
        case "assignee":
          key = row.assignee?.id ?? NONE;
          label = row.assignee?.name ?? "Unassigned";
          break;
        case "priority":
          key = row.priority;
          label = PRIORITY_LABELS[row.priority];
          break;
        case "type":
          key = row.customType ? `custom:${row.customType.name}` : row.type;
          label = row.customType?.name ?? ISSUE_TYPE_LABELS[row.type];
          break;
        case "epic":
          key = row.epic?.key ?? NONE;
          label = row.epic ? `${row.epic.key} ${row.epic.title}` : "No epic";
          break;
        default:
          key = row.sprint?.id ?? NONE;
          label = row.sprint?.name ?? "No sprint";
      }
    }
    let group = groups.get(key);
    if (!group) groups.set(key, (group = { key, label, rows: [], points: 0 }));
    group.rows.push(row);
    group.points += row.estimate ?? 0;
  }

  const rank = (g: RowGroup): number => {
    if (g.key === NONE) return Number.MAX_SAFE_INTEGER;
    if (groupBy === "status") return ctx.statusOrder.indexOf(g.key);
    if (groupBy === "priority") return PRIORITIES.length - PRIORITIES.indexOf(g.key as Priority);
    return 0;
  };
  return [...groups.values()].sort(
    (a, b) => rank(a) - rank(b) || (rank(a) === 0 ? a.label.localeCompare(b.label) : 0),
  );
}

export function sumPoints(rows: ListRow[]): number {
  return rows.reduce((sum, r) => sum + (r.estimate ?? 0), 0);
}

const quote = (value: string) =>
  /^[A-Za-z0-9_\-.@+]+$/.test(value) ? value : `"${value.replace(/"/g, '\\"')}"`;

const ORDER: Record<IssueFilters["sort"], string> = {
  updated: "updated DESC",
  created: "created DESC",
  priority: "priority DESC",
  key: "key DESC",
};

/** The list's filters as TQL — for CSV export and "Save as filter". */
export function filtersToTql(
  projectKey: string,
  filters: IssueFilters,
  ctx: { statuses: { id: string; name: string }[]; people: { id: string; email: string }[] },
): string {
  const parts = [`project = ${quote(projectKey)}`];
  const statusNames = filters.statusIds
    .map((id) => ctx.statuses.find((s) => s.id === id)?.name)
    .filter((n): n is string => Boolean(n));
  if (statusNames.length) parts.push(`status IN (${statusNames.map(quote).join(", ")})`);
  if (filters.assignee === "me") parts.push("assignee = currentUser()");
  else if (filters.assignee === "none") parts.push("assignee IS EMPTY");
  else if (filters.assignee) {
    const email = ctx.people.find((p) => p.id === filters.assignee)?.email;
    if (email) parts.push(`assignee = ${quote(email)}`);
  }
  if (filters.types.length) parts.push(`type IN (${filters.types.join(", ")})`);
  if (filters.priorities.length) parts.push(`priority IN (${filters.priorities.join(", ")})`);
  if (filters.q) parts.push(`text ~ ${quote(filters.q)}`);
  return `${parts.join(" AND ")} ORDER BY ${ORDER[filters.sort]}`;
}
