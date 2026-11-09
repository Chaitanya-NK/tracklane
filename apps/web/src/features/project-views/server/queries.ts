import "server-only";
import { formatIssueKey } from "@tracklane/core";
import { db } from "@tracklane/db";
import type { IssueFilters } from "@/features/issues";
import { listProjectIssues } from "@/features/issues/server";
import type { GroupableField, ListRow } from "../model";

/** Custom fields the list can group by (single-choice and person fields). */
export async function listGroupableFields(projectId: string): Promise<GroupableField[]> {
  return db.customField.findMany({
    where: { projectId, type: { in: ["select", "user"] } },
    orderBy: { position: "asc" },
    select: { id: true, name: true },
  });
}

/** The project's issues for the list, with epic, sprint and groupable field values. */
export async function listRows(
  projectId: string,
  userId: string,
  filters: IssueFilters,
  fields: GroupableField[],
): Promise<{ rows: ListRow[]; truncated: boolean }> {
  const { issues, truncated } = await listProjectIssues(projectId, userId, filters);
  const ids = issues.map((i) => i.id);
  const [extra, values] = await Promise.all([
    db.issue.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        sprint: { select: { id: true, name: true } },
        parent: {
          select: { number: true, title: true, type: true, project: { select: { key: true } } },
        },
      },
    }),
    fields.length
      ? db.issueFieldValue.findMany({
          where: { issueId: { in: ids }, fieldId: { in: fields.map((f) => f.id) } },
          select: {
            issueId: true,
            fieldId: true,
            optionIds: true,
            user: { select: { name: true } },
            field: { select: { options: { select: { id: true, value: true } } } },
          },
        })
      : Promise.resolve([]),
  ]);
  const byId = new Map(extra.map((e) => [e.id, e]));
  const fieldValues = new Map<string, Record<string, string>>();
  for (const v of values) {
    const label = v.user?.name ?? v.field.options.find((o) => o.id === v.optionIds[0])?.value;
    if (!label) continue;
    const map = fieldValues.get(v.issueId) ?? {};
    map[v.fieldId] = label;
    fieldValues.set(v.issueId, map);
  }

  const rows = issues.map((issue): ListRow => {
    const more = byId.get(issue.id);
    const parent = more?.parent;
    return {
      id: issue.id,
      key: formatIssueKey(issue.project.key, issue.number),
      title: issue.title,
      type: issue.type,
      customType: issue.customType,
      priority: issue.priority,
      status: issue.status,
      assignee: issue.assignee,
      labels: issue.labels.map((l) => l.label),
      estimate: issue.estimate,
      dueDate: issue.dueDate ? issue.dueDate.toISOString().slice(0, 10) : null,
      createdAt: issue.createdAt.toISOString(),
      updatedAt: issue.updatedAt.toISOString(),
      sprint: more?.sprint ?? null,
      epic:
        parent && parent.type === "epic"
          ? { key: formatIssueKey(parent.project.key, parent.number), title: parent.title }
          : null,
      fields: fieldValues.get(issue.id) ?? {},
    };
  });
  return { rows, truncated };
}
