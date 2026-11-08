import { ISSUE_TYPES, type IssueType, PRIORITIES, type Priority } from "@tracklane/core";

/** Filters for the project issue list, round-tripped through the URL (?q=&status=&…). */
export interface IssueFilters {
  q: string;
  statusIds: string[];
  /** "me", "none", or a user id. */
  assignee: string | null;
  types: IssueType[];
  priorities: Priority[];
  sort: IssueSort;
}

export const ISSUE_SORTS = ["updated", "created", "priority", "key"] as const;
export type IssueSort = (typeof ISSUE_SORTS)[number];

type SearchParams = Record<string, string | string[] | undefined>;

const list = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value : value ? value.split(",") : [])
    .map((v) => v.trim())
    .filter(Boolean);

export function parseIssueFilters(params: SearchParams): IssueFilters {
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 200) : "";
  const assignee = typeof params.assignee === "string" && params.assignee ? params.assignee : null;
  const sort = ISSUE_SORTS.find((s) => s === params.sort) ?? "updated";
  return {
    q,
    statusIds: list(params.status),
    assignee,
    types: list(params.type).filter((t): t is IssueType =>
      (ISSUE_TYPES as readonly string[]).includes(t),
    ),
    priorities: list(params.priority).filter((p): p is Priority =>
      (PRIORITIES as readonly string[]).includes(p),
    ),
    sort,
  };
}

/** Serialises filters back to a query string, omitting defaults. */
export function serializeIssueFilters(filters: Partial<IssueFilters>): string {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.statusIds?.length) params.set("status", filters.statusIds.join(","));
  if (filters.assignee) params.set("assignee", filters.assignee);
  if (filters.types?.length) params.set("type", filters.types.join(","));
  if (filters.priorities?.length) params.set("priority", filters.priorities.join(","));
  if (filters.sort && filters.sort !== "updated") params.set("sort", filters.sort);
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function hasActiveFilters(filters: IssueFilters): boolean {
  return Boolean(
    filters.q ||
    filters.statusIds.length ||
    filters.assignee ||
    filters.types.length ||
    filters.priorities.length,
  );
}
