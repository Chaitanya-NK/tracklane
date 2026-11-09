import { formatDuration } from "@tracklane/core";
import { ChevronLeftIcon, ChevronRightIcon, ClockIcon } from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { EmptyState } from "@/components/shared/empty-state";
import { TableSkeleton } from "@/components/shared/skeletons";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PendingTimesheets, TimerCard, TimesheetEditor } from "@/features/time";
import {
  getSubmission,
  getTimer,
  getTimesheet,
  listPendingTimesheets,
  weekStart,
} from "@/features/time/server";
import { can } from "@tracklane/core";
import { getWorkspaceAccess } from "@/server/authz";

export const metadata: Metadata = { title: "Timesheets" };

type Props = PageProps<"/[workspace]/teams/timesheets">;

const DAY = 86_400_000;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const fmt = (m: number) => (m ? formatDuration(m) : "");

async function Timesheet({ params, searchParams }: Props) {
  const [{ workspace: slug }, sp] = await Promise.all([params, searchParams]);
  const { workspace, user, role } = await getWorkspaceAccess(slug);
  const requested =
    typeof sp.week === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.week)
      ? new Date(`${sp.week}T00:00:00Z`)
      : new Date();
  const start = weekStart(requested);
  const mine = sp.who !== "all";
  const rows = await getTimesheet({
    workspaceId: workspace.id,
    start,
    userId: mine ? user.id : undefined,
  });
  const days = Array.from({ length: 7 }, (_, i) => new Date(start.getTime() + i * DAY));
  const totals = days.map((_, i) => rows.reduce((s, r) => s + (r.days[i] ?? 0), 0));
  const link = (week: Date, who = mine ? "me" : "all") =>
    `/${slug}/teams/timesheets?week=${iso(week)}${who === "all" ? "&who=all" : ""}` as Route;
  const isAdmin = can(role, "members:update_role");
  const [submission, timer, pending] = await Promise.all([
    getSubmission(workspace.id, user.id, start),
    getTimer(user.id),
    isAdmin ? listPendingTimesheets(workspace.id) : Promise.resolve([]),
  ]);
  const side = (
    <aside className="w-full space-y-4 xl:w-80">
      <TimerCard slug={slug} timer={timer} />
      {isAdmin ? (
        <PendingTimesheets
          slug={slug}
          items={pending.map((p) => ({ ...p, weekStart: iso(p.weekStart) }))}
        />
      ) : null}
    </aside>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="size-8" asChild>
            <Link href={link(new Date(start.getTime() - 7 * DAY))} aria-label="Previous week">
              <ChevronLeftIcon />
            </Link>
          </Button>
          <span className="px-2 text-sm font-medium">
            Week of{" "}
            {start.toLocaleDateString(undefined, {
              day: "numeric",
              month: "long",
              year: "numeric",
              timeZone: "UTC",
            })}
          </span>
          <Button variant="outline" size="icon" className="size-8" asChild>
            <Link href={link(new Date(start.getTime() + 7 * DAY))} aria-label="Next week">
              <ChevronRightIcon />
            </Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link href={link(new Date())}>This week</Link>
          </Button>
        </div>
        <div className="flex gap-1" role="group" aria-label="Whose time">
          <Button variant={mine ? "secondary" : "ghost"} size="sm" asChild aria-pressed={mine}>
            <Link href={link(start, "me")}>My time</Link>
          </Button>
          <Button variant={mine ? "ghost" : "secondary"} size="sm" asChild aria-pressed={!mine}>
            <Link href={link(start, "all")}>Everyone</Link>
          </Button>
        </div>
      </div>
      {mine ? (
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
          <div className="min-w-0 flex-1">
            <TimesheetEditor
              key={iso(start)}
              slug={slug}
              week={iso(start)}
              rows={rows.map((r) => ({
                issue: { id: r.issue.id, key: r.issue.key, title: r.issue.title },
                days: r.days,
                total: r.total,
                billableMinutes: r.billableMinutes,
              }))}
              status={submission?.status ?? "draft"}
              reviewNote={submission?.note || null}
              today={iso(new Date())}
            />
          </div>
          {side}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={ClockIcon}
          title="No time logged this week"
          description="Log time from an issue's details panel."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                {!mine ? <TableHead>Person</TableHead> : null}
                <TableHead>Issue</TableHead>
                {days.map((d) => (
                  <TableHead key={iso(d)} className="w-16 text-right">
                    {d.toLocaleDateString(undefined, {
                      weekday: "short",
                      day: "numeric",
                      timeZone: "UTC",
                    })}
                  </TableHead>
                ))}
                <TableHead className="w-20 text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={`${r.user?.id}:${r.issue.id}`}>
                  {!mine ? (
                    <TableCell>
                      <span className="flex items-center gap-2">
                        <UserAvatar user={r.user ?? { name: "?", image: null }} />
                        {r.user?.name ?? "Former member"}
                      </span>
                    </TableCell>
                  ) : null}
                  <TableCell className="max-w-72">
                    <Link
                      href={`/${slug}/issues/${r.issue.key}` as Route}
                      className="flex min-w-0 gap-2 hover:underline"
                    >
                      <span className="font-mono text-xs text-muted-foreground">{r.issue.key}</span>
                      <span className="truncate">{r.issue.title}</span>
                    </Link>
                  </TableCell>
                  {r.days.map((m, i) => (
                    <TableCell key={i} className="text-right tabular-nums">
                      {fmt(m)}
                    </TableCell>
                  ))}
                  <TableCell className="text-right font-medium tabular-nums">
                    {fmt(r.total)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={mine ? 1 : 2}>Total</TableCell>
                {totals.map((m, i) => (
                  <TableCell key={i} className="text-right tabular-nums">
                    {fmt(m)}
                  </TableCell>
                ))}
                <TableCell className="text-right tabular-nums">
                  {fmt(totals.reduce((a, b) => a + b, 0))}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      )}
    </div>
  );
}

export default function TimesheetsPage(props: Props) {
  return (
    <Suspense fallback={<TableSkeleton />}>
      <Timesheet {...props} />
    </Suspense>
  );
}
