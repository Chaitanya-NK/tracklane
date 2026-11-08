import type { Route } from "next";
import Link from "next/link";
import { TimeAgo } from "@/components/shared/time-ago";
import { UserAvatar } from "@/components/shared/user-avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import type { IssueListRow } from "../server/queries";
import { IssueTypeIcon, LabelBadge, PriorityIcon, StatusBadge } from "./issue-meta";

/** Overdue = due before today (UTC) and not done. */
function isOverdue(dueDate: Date | null, category: string) {
  return Boolean(dueDate && category !== "done" && dueDate.getTime() < Date.now() - 86_400_000);
}

/** Read-only issue table. Each row links to the issue page. */
export function IssueTable({
  slug,
  issues,
  showProject = false,
}: {
  slug: string;
  issues: IssueListRow[];
  showProject?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-28">Key</TableHead>
            <TableHead>Summary</TableHead>
            <TableHead className="w-36">Status</TableHead>
            <TableHead className="hidden w-40 md:table-cell">Assignee</TableHead>
            <TableHead className="hidden w-28 lg:table-cell">Due</TableHead>
            <TableHead className="hidden w-28 lg:table-cell">Updated</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {issues.map((issue) => {
            const key = `${issue.project.key}-${issue.number}`;
            const href = `/${slug}/issues/${key}` as Route;
            const overdue = isOverdue(issue.dueDate, issue.status.category);
            return (
              <TableRow key={issue.id} className="group relative">
                <TableCell>
                  <div className="flex items-center gap-2">
                    <IssueTypeIcon type={issue.type} />
                    <Link
                      href={href}
                      className="font-mono text-xs text-muted-foreground group-hover:underline after:absolute after:inset-0"
                    >
                      {key}
                    </Link>
                  </div>
                </TableCell>
                <TableCell className="w-full max-w-0">
                  <div className="flex items-center gap-2">
                    <PriorityIcon priority={issue.priority} />
                    <span
                      className={
                        issue.status.category === "done"
                          ? "min-w-0 flex-1 truncate text-muted-foreground line-through"
                          : "min-w-0 flex-1 truncate font-medium"
                      }
                    >
                      {issue.title}
                    </span>
                    {showProject ? (
                      <span className="hidden max-w-32 shrink truncate text-xs text-muted-foreground 2xl:inline">
                        {issue.project.name}
                      </span>
                    ) : (
                      <span className="hidden shrink-0 gap-1 xl:flex">
                        {issue.labels.slice(0, 2).map(({ label }) => (
                          <LabelBadge key={label.id} label={label} />
                        ))}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <StatusBadge status={issue.status} />
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  {issue.assignee ? (
                    <span className="flex items-center gap-2">
                      <UserAvatar user={issue.assignee} />
                      <span className="truncate text-sm">{issue.assignee.name}</span>
                    </span>
                  ) : (
                    <span className="text-sm text-muted-foreground">Unassigned</span>
                  )}
                </TableCell>
                <TableCell
                  className={
                    overdue
                      ? "hidden text-sm text-destructive lg:table-cell"
                      : "hidden text-sm text-muted-foreground lg:table-cell"
                  }
                >
                  {issue.dueDate
                    ? formatDate(issue.dueDate, { day: "numeric", month: "short" })
                    : "—"}
                </TableCell>
                <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">
                  <TimeAgo date={issue.updatedAt} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
