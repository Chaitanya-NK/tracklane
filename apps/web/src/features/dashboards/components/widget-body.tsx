import { averageVelocity, formatIssueKey } from "@tracklane/core";
import type { Route } from "next";
import Link from "next/link";
import { db } from "@tracklane/db";
import { IssueTypeIcon, PriorityIcon, StatusBadge } from "@/features/issues";
import { UserAvatar } from "@/components/shared/user-avatar";
import { TimeAgo } from "@/components/shared/time-ago";
import {
  BreakdownChart,
  BurndownChart,
  CreatedResolvedChart,
  DonutChart,
  VelocityChart,
} from "@/features/reports";
import {
  getActivityHeatmap,
  getBreakdown,
  getBurndown,
  getCreatedResolved,
  getMatrix,
  getRecentlyResolved,
  getSprintHealth,
  getVelocity,
} from "@/features/reports/server";
import { cn } from "@/lib/utils";
import { searchIssues, tqlWhere } from "@/features/search/server";
import { slaReport } from "@/features/sla/server";
import { type Widget } from "../widgets";

const filtersLink = (slug: string, query: string) =>
  `/${slug}/filters?q=${encodeURIComponent(query)}` as Route;

const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000);

function Problem({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

/** Renders one widget's content on the server (data is fetched per widget, in parallel). */
export async function WidgetBody({
  widget,
  slug,
  workspaceId,
  userId,
}: {
  widget: Widget;
  slug: string;
  workspaceId: string;
  userId: string;
}) {
  const { config } = widget;
  const query = config.query ?? "";

  if (widget.type === "count" || widget.type === "list") {
    const result = await searchIssues({
      workspaceId,
      userId,
      query,
      pageSize: widget.type === "count" ? 1 : (config.limit ?? 5),
    });
    if (!result.ok) return <Problem>Query error: {result.error.message}</Problem>;
    if (widget.type === "count") {
      return (
        <Link href={filtersLink(slug, query)} className="group block">
          <span className="text-4xl font-semibold tabular-nums group-hover:underline">
            {result.total}
          </span>
          <span className="ml-2 text-sm text-muted-foreground">
            {result.total === 1 ? "issue" : "issues"}
          </span>
        </Link>
      );
    }
    if (!result.issues.length) return <Problem>No issues match.</Problem>;
    return (
      <div className="space-y-2">
        <ul className="divide-y text-sm">
          {result.issues.map((issue) => {
            const key = formatIssueKey(issue.project.key, issue.number);
            return (
              <li key={issue.id} className="flex items-center gap-2 py-1.5">
                <IssueTypeIcon type={issue.type} />
                <Link
                  href={`/${slug}/issues/${key}` as Route}
                  className="font-mono text-xs text-muted-foreground hover:underline"
                >
                  {key}
                </Link>
                <Link
                  href={`/${slug}/issues/${key}` as Route}
                  className="min-w-0 flex-1 truncate hover:underline"
                >
                  {issue.title}
                </Link>
                <PriorityIcon priority={issue.priority} />
                <StatusBadge status={issue.status} />
              </li>
            );
          })}
        </ul>
        {result.total > result.issues.length ? (
          <Link
            href={filtersLink(slug, query)}
            className="text-xs text-muted-foreground hover:underline"
          >
            View all {result.total}
          </Link>
        ) : null}
      </div>
    );
  }

  if (
    widget.type === "breakdown" ||
    widget.type === "created_resolved" ||
    widget.type === "donut" ||
    widget.type === "two_d" ||
    widget.type === "heatmap" ||
    widget.type === "resolved"
  ) {
    const where = await tqlWhere({ workspaceId, userId, query });
    if (!where.ok) return <Problem>Query error: {where.message}</Problem>;
    if (widget.type === "donut") {
      const rows = await getBreakdown(where.where, config.field ?? "statusCategory");
      return rows.length ? (
        <DonutChart rows={rows.slice(0, 8)} label={config.field ?? "statusCategory"} />
      ) : (
        <Problem>No issues match.</Problem>
      );
    }
    if (widget.type === "two_d") {
      const matrix = await getMatrix(
        where.where,
        config.field ?? "assignee",
        config.field2 ?? "statusCategory",
      );
      if (!matrix.rows.length) return <Problem>No issues match.</Problem>;
      const columns = matrix.columns.slice(0, 8);
      return (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b">
                <th className="py-1.5 pr-2 text-left font-medium" />
                {columns.map((c) => (
                  <th key={c} className="px-2 py-1.5 text-right font-medium whitespace-nowrap">
                    {c}
                  </th>
                ))}
                <th className="py-1.5 pl-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {matrix.rows.slice(0, 15).map((row) => (
                <tr key={row.name} className="border-b last:border-0">
                  <td className="max-w-40 truncate py-1.5 pr-2">{row.name}</td>
                  {row.counts.slice(0, 8).map((n, i) => (
                    <td
                      key={columns[i]}
                      className={cn(
                        "px-2 py-1.5 text-right tabular-nums",
                        !n && "text-muted-foreground/50",
                      )}
                    >
                      {n || "·"}
                    </td>
                  ))}
                  <td className="py-1.5 pl-2 text-right font-medium tabular-nums">{row.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    if (widget.type === "heatmap") {
      const { days, total } = await getActivityHeatmap(where.where);
      const max = Math.max(1, ...days.map((d) => d.count));
      const tone = (n: number) =>
        !n
          ? "bg-muted"
          : n / max > 0.75
            ? "bg-emerald-600"
            : n / max > 0.4
              ? "bg-emerald-500/70"
              : n / max > 0.15
                ? "bg-emerald-400/50"
                : "bg-emerald-300/40";
      const firstWeekday = (new Date(`${days[0]!.date}T00:00:00Z`).getUTCDay() + 6) % 7;
      return (
        <div className="space-y-2">
          <div
            className="grid w-max grid-flow-col grid-rows-7 gap-1"
            role="img"
            aria-label={`${total} changes in 12 weeks`}
          >
            {Array.from({ length: firstWeekday }, (_, i) => (
              <span key={`pad-${i}`} className="size-3" />
            ))}
            {days.map((d) => (
              <span
                key={d.date}
                title={`${d.date}: ${d.count}`}
                className={cn("size-3 rounded-[3px]", tone(d.count))}
              />
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{total} changes in the last 12 weeks</p>
        </div>
      );
    }
    if (widget.type === "resolved") {
      const issues = await getRecentlyResolved(where.where, config.limit ?? 5);
      if (!issues.length) return <Problem>Nothing resolved yet.</Problem>;
      return (
        <ul className="divide-y text-sm">
          {issues.map((i) => (
            <li key={i.id} className="flex items-center gap-2 py-1.5">
              <IssueTypeIcon type={i.type} />
              <Link
                href={`/${slug}/issues/${i.key}` as Route}
                className="font-mono text-xs text-muted-foreground hover:underline"
              >
                {i.key}
              </Link>
              <span className="min-w-0 flex-1 truncate">{i.title}</span>
              <span className="text-xs text-muted-foreground">
                {i.resolution?.name ?? "Done"} · <TimeAgo date={i.resolvedAt!} />
              </span>
              {i.assignee ? <UserAvatar user={i.assignee} className="size-5" /> : null}
            </li>
          ))}
        </ul>
      );
    }
    if (widget.type === "breakdown") {
      const rows = await getBreakdown(where.where, config.field ?? "status");
      return rows.length ? (
        <BreakdownChart rows={rows} label={config.field ?? "status"} />
      ) : (
        <Problem>No issues match.</Problem>
      );
    }
    return (
      <CreatedResolvedChart
        points={await getCreatedResolved(where.where, config.days ?? 30)}
        height={200}
      />
    );
  }

  const project = await db.project.findFirst({
    where: { workspaceId, key: config.projectKey ?? "", archivedAt: null },
    select: { id: true, type: true, key: true },
  });
  if (!project) return <Problem>Project {config.projectKey} isn&apos;t available.</Problem>;
  if (widget.type === "burndown") {
    if (project.type !== "scrum")
      return <Problem>{project.key} is a Kanban project (no sprints).</Problem>;
    const burn = await getBurndown(project.id);
    return burn.sprint ? (
      <div>
        <p className="mb-1 text-xs text-muted-foreground">{burn.sprint.name}</p>
        <BurndownChart points={burn.points} height={200} />
      </div>
    ) : (
      <Problem>No active sprint.</Problem>
    );
  }
  if (widget.type === "sprint_health") {
    const health = await getSprintHealth(project.id);
    if (!health) return <Problem>{project.key} has no active sprint.</Problem>;
    const behind = health.workPct + 10 < health.timePct;
    return (
      <div className="space-y-3 text-sm">
        <p className="flex justify-between text-xs text-muted-foreground">
          <span>{health.name}</span>
          <span>{health.daysLeft} days left</span>
        </p>
        {[
          ["Time elapsed", health.timePct, "bg-muted-foreground/60"],
          ["Work done", health.workPct, behind ? "bg-destructive" : "bg-emerald-600"],
        ].map(([label, pct, tone]) => (
          <div key={label as string} className="space-y-1">
            <p className="flex justify-between">
              <span>{label}</span>
              <span className="tabular-nums">{pct}%</span>
            </p>
            <span className="block h-2 overflow-hidden rounded-full bg-muted">
              <span className={cn("block h-full", tone as string)} style={{ width: `${pct}%` }} />
            </span>
          </div>
        ))}
        <p className={cn("text-xs", behind ? "text-destructive" : "text-muted-foreground")}>
          {behind ? "Behind schedule" : "On track"} · {health.done}/{health.points} pts
          {health.scopeAdded ? ` · +${health.scopeAdded} pts added` : ""}
          {health.flagged ? ` · ${health.flagged} flagged` : ""}
          {health.blocked ? ` · ${health.blocked} blocked` : ""}
        </p>
      </div>
    );
  }
  if (widget.type === "velocity") {
    const points = await getVelocity(project.id);
    return points.length ? (
      <div>
        <p className="mb-1 text-xs text-muted-foreground">
          Average (last 3): {averageVelocity(points)} points
        </p>
        <VelocityChart points={points} height={200} />
      </div>
    ) : (
      <Problem>No completed sprints yet.</Problem>
    );
  }
  const rows = await slaReport(project.id, workspaceId, daysAgo(30));
  if (!rows.length) return <Problem>{project.key} has no SLAs.</Problem>;
  return (
    <ul className="divide-y text-sm">
      {rows.map((r) => (
        <li key={r.policy.id} className="flex items-center gap-3 py-2">
          <span className="min-w-0 flex-1 truncate">{r.policy.name}</span>
          <span className="text-xs text-muted-foreground">
            {r.counts.breached} breached · {r.counts.at_risk} at risk
          </span>
          <span className="w-12 text-right font-semibold tabular-nums">
            {r.metRate === null ? "—" : `${r.metRate}%`}
          </span>
        </li>
      ))}
    </ul>
  );
}
