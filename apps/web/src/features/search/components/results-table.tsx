"use client";

import { ArrowDownIcon, ArrowUpIcon } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { TimeAgo } from "@/components/shared/time-ago";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { IssueTypeIcon, LabelBadge, PriorityIcon, StatusBadge } from "@/features/issues";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { SearchIssue } from "../types";

const COLUMNS = [
  { field: "key", label: "Key", className: "w-28" },
  { field: "summary", label: "Summary", className: "" },
  { field: "project", label: "Project", className: "hidden w-40 lg:table-cell" },
  { field: "status", label: "Status", className: "w-36" },
  { field: "assignee", label: "Assignee", className: "hidden w-40 md:table-cell" },
  { field: "priority", label: "P", name: "priority", className: "w-12" },
  { field: "due", label: "Due", className: "hidden w-24 xl:table-cell" },
  { field: "updated", label: "Updated", className: "hidden w-28 xl:table-cell" },
] as const;

export function ResultsTable({
  slug,
  issues,
  selected,
  onSelectedChange,
  selectable,
  order,
  onSort,
}: {
  slug: string;
  issues: SearchIssue[];
  selected: Set<string>;
  onSelectedChange: (next: Set<string>) => void;
  selectable: boolean;
  order: { field: string; direction: "asc" | "desc" } | null;
  onSort: (field: string, direction: "asc" | "desc") => void;
}) {
  const allSelected = issues.length > 0 && issues.every((i) => selected.has(i.id));
  const someSelected = issues.some((i) => selected.has(i.id));

  return (
    <div className="overflow-hidden rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            {selectable ? (
              <TableHead className="w-10">
                <Checkbox
                  className="data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground"
                  aria-label="Select all on this page"
                  checked={allSelected ? true : someSelected ? "indeterminate" : false}
                  onCheckedChange={(checked) => {
                    const next = new Set(selected);
                    for (const issue of issues) {
                      if (checked) next.add(issue.id);
                      else next.delete(issue.id);
                    }
                    onSelectedChange(next);
                  }}
                />
              </TableHead>
            ) : null}
            {COLUMNS.map((col) => {
              const active = order?.field === col.field;
              return (
                <TableHead key={col.field} className={col.className}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="-ml-2 h-7 px-2 font-medium"
                    onClick={() =>
                      onSort(col.field, active && order?.direction === "asc" ? "desc" : "asc")
                    }
                    aria-label={`Sort by ${"name" in col ? col.name : col.label.toLowerCase()}`}
                  >
                    {col.label}
                    {active ? (
                      order?.direction === "asc" ? (
                        <ArrowUpIcon aria-hidden="true" />
                      ) : (
                        <ArrowDownIcon aria-hidden="true" />
                      )
                    ) : null}
                  </Button>
                </TableHead>
              );
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {issues.map((issue) => (
            <TableRow key={issue.id} data-state={selected.has(issue.id) ? "selected" : undefined}>
              {selectable ? (
                <TableCell>
                  <Checkbox
                    aria-label={`Select ${issue.key}`}
                    checked={selected.has(issue.id)}
                    onCheckedChange={(checked) => {
                      const next = new Set(selected);
                      if (checked) next.add(issue.id);
                      else next.delete(issue.id);
                      onSelectedChange(next);
                    }}
                  />
                </TableCell>
              ) : null}
              <TableCell>
                <span className="flex items-center gap-2">
                  <IssueTypeIcon type={issue.type} />
                  <Link
                    href={`/${slug}/issues/${issue.key}` as Route}
                    className="font-mono text-xs text-muted-foreground hover:underline"
                  >
                    {issue.key}
                  </Link>
                </span>
              </TableCell>
              <TableCell className="w-full max-w-0">
                <span className="flex items-center gap-2">
                  <Link
                    href={`/${slug}/issues/${issue.key}` as Route}
                    className={cn(
                      "min-w-0 flex-1 truncate font-medium hover:underline",
                      issue.status.category === "done" && "text-muted-foreground line-through",
                    )}
                  >
                    {issue.title}
                  </Link>
                  <span className="hidden shrink-0 gap-1 2xl:flex">
                    {issue.labels.slice(0, 2).map((label) => (
                      <LabelBadge key={label.id} label={label} />
                    ))}
                  </span>
                </span>
              </TableCell>
              <TableCell className="hidden truncate text-sm text-muted-foreground lg:table-cell">
                {issue.project.name}
              </TableCell>
              <TableCell>
                <StatusBadge status={issue.status} />
              </TableCell>
              <TableCell className="hidden md:table-cell">
                {issue.assignee ? (
                  <span className="flex items-center gap-2 text-sm">
                    <UserAvatar user={issue.assignee} />
                    <span className="truncate">{issue.assignee.name}</span>
                  </span>
                ) : (
                  <span className="text-sm text-muted-foreground">Unassigned</span>
                )}
              </TableCell>
              <TableCell>
                <PriorityIcon priority={issue.priority} />
              </TableCell>
              <TableCell className="hidden text-sm text-muted-foreground xl:table-cell">
                {issue.dueDate
                  ? formatDate(issue.dueDate, { day: "numeric", month: "short" })
                  : "—"}
              </TableCell>
              <TableCell className="hidden text-sm text-muted-foreground xl:table-cell">
                <TimeAgo date={issue.updatedAt} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
