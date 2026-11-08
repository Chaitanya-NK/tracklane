import { formatIssueKey } from "@tracklane/core";
import type { SearchRow } from "./search";

/** RFC 4180 field; also defuses spreadsheet formulas (values starting with = + - @). */
export function csvField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const date = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

export function issuesToCsv(rows: SearchRow[]): string {
  const header = [
    "Key",
    "Summary",
    "Project",
    "Type",
    "Status",
    "Priority",
    "Assignee",
    "Reporter",
    "Sprint",
    "Labels",
    "Story points",
    "Start",
    "Due",
    "Created",
    "Updated",
    "Resolved",
  ];
  const lines = rows.map((r) =>
    [
      formatIssueKey(r.project.key, r.number),
      r.title,
      r.project.name,
      r.type,
      r.status.name,
      r.priority,
      r.assignee?.name,
      r.reporter?.name,
      r.sprint?.name,
      r.labels.map((l) => l.label.name).join("; "),
      r.estimate,
      date(r.startDate),
      date(r.dueDate),
      r.createdAt.toISOString(),
      r.updatedAt.toISOString(),
      r.resolvedAt?.toISOString(),
    ]
      .map(csvField)
      .join(","),
  );
  return [header.join(","), ...lines].join("\r\n") + "\r\n";
}
