import "server-only";
import { db } from "@tracklane/db";
import type { CustomFieldDef, CustomFieldValue } from "../types";

export async function listCustomFields(projectId: string): Promise<CustomFieldDef[]> {
  const fields = await db.customField.findMany({
    where: { projectId },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      name: true,
      description: true,
      type: true,
      required: true,
      options: { orderBy: { position: "asc" }, select: { id: true, value: true, color: true } },
      _count: { select: { values: true } },
    },
  });
  return fields.map(({ _count, ...f }) => ({ ...f, usage: _count.values }));
}

/** An issue's values keyed by field id, in the shape the editors use. */
export async function getIssueFieldValues(
  issueId: string,
): Promise<Record<string, CustomFieldValue>> {
  const rows = await db.issueFieldValue.findMany({ where: { issueId } });
  return Object.fromEntries(
    rows.map((row) => [
      row.fieldId,
      row.textValue ??
        row.numberValue ??
        (row.dateValue ? row.dateValue.toISOString().slice(0, 10) : null) ??
        row.boolValue ??
        row.userId ??
        row.optionIds,
    ]),
  );
}
