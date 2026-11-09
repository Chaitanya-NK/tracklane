import { formatDuration } from "@tracklane/core";
import { UserAvatar } from "@/components/shared/user-avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export interface WorkloadItem {
  user: { id: string; name: string; image: string | null } | null;
  todo: number;
  inProgress: number;
  points: number;
  overdue: number;
  loggedMinutes: number;
}

/** Open work per person, with an inline bar so heavy loads stand out. */
export function WorkloadTable({ rows }: { rows: WorkloadItem[] }) {
  const max = Math.max(1, ...rows.map((r) => r.todo + r.inProgress));
  return (
    <div className="overflow-hidden rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Person</TableHead>
            <TableHead className="w-[40%]">Open issues</TableHead>
            <TableHead className="text-right">Points</TableHead>
            <TableHead className="text-right">Overdue</TableHead>
            <TableHead className="text-right">Logged this week</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.user?.id ?? "unassigned"}>
              <TableCell>
                <span className="flex items-center gap-2">
                  {r.user ? <UserAvatar user={r.user} /> : null}
                  <span className={cn(!r.user && "text-muted-foreground")}>
                    {r.user?.name ?? "Unassigned"}
                  </span>
                </span>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <div className="flex h-2.5 flex-1 gap-0.5 overflow-hidden" aria-hidden="true">
                    <span
                      className="rounded-l-sm bg-[var(--viz-2)]"
                      style={{ width: `${(r.inProgress / max) * 100}%` }}
                    />
                    <span
                      className="rounded-r-sm bg-[var(--viz-1)]"
                      style={{ width: `${(r.todo / max) * 100}%` }}
                    />
                  </div>
                  <span className="w-28 text-right text-xs text-muted-foreground tabular-nums">
                    {r.inProgress} in progress · {r.todo} to do
                  </span>
                </div>
              </TableCell>
              <TableCell className="text-right tabular-nums">{r.points}</TableCell>
              <TableCell
                className={cn(
                  "text-right tabular-nums",
                  r.overdue && "font-medium text-destructive",
                )}
              >
                {r.overdue}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatDuration(r.loggedMinutes)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <p className="flex gap-4 border-t px-3 py-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-[var(--viz-2)]" /> In progress
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-[var(--viz-1)]" /> To do
        </span>
      </p>
    </div>
  );
}
