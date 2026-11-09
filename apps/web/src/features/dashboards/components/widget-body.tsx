import { averageVelocity, formatIssueKey } from "@tracklane/core";
import type { Route } from "next";
import Link from "next/link";
import { db } from "@tracklane/db";
import { IssueTypeIcon, PriorityIcon, StatusBadge } from "@/features/issues";
import {
  BreakdownChart,
  BurndownChart,
  CreatedResolvedChart,
  VelocityChart,
} from "@/features/reports";
import {
  getBreakdown,
  getBurndown,
  getCreatedResolved,
  getVelocity,
} from "@/features/reports/server";
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

  if (widget.type === "breakdown" || widget.type === "created_resolved") {
    const where = await tqlWhere({ workspaceId, userId, query });
    if (!where.ok) return <Problem>Query error: {where.message}</Problem>;
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
