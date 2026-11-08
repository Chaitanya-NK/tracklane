/**
 * Turns a before/after snapshot of an issue into history rows. Pure, so it's unit-tested and
 * shared by every code path that changes an issue.
 */
export interface IssueSnapshot {
  title: string;
  description: string;
  type: string;
  priority: string;
  status: string;
  assignee: string | null;
  dueDate: string | null;
  estimate: number | null;
  parent: string | null;
  labels: string[];
}

export interface ActivityChange {
  field: keyof IssueSnapshot;
  fromValue: string | null;
  toValue: string | null;
}

const asText = (value: unknown): string | null => {
  if (value === null || value === undefined || value === "") return null;
  if (Array.isArray(value)) return value.length ? [...value].sort().join(", ") : null;
  return String(value);
};

export function diffIssue(before: IssueSnapshot, after: IssueSnapshot): ActivityChange[] {
  const changes: ActivityChange[] = [];
  for (const field of Object.keys(after) as (keyof IssueSnapshot)[]) {
    const from = asText(before[field]);
    const to = asText(after[field]);
    if (from === to) continue;
    // Descriptions can be long; history only records that it changed.
    if (field === "description") changes.push({ field, fromValue: null, toValue: null });
    else changes.push({ field, fromValue: from, toValue: to });
  }
  return changes;
}
