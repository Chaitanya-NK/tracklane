import "server-only";
import {
  burndown,
  createdVsResolved,
  cumulativeFlow,
  isoDay,
  PRIORITIES,
  PRIORITY_LABELS,
  ISSUE_TYPE_LABELS,
  STATUS_CATEGORY_LABELS,
  type VelocityPoint,
} from "@tracklane/core";
import { db, measureProject, type Prisma } from "@tracklane/db";

const DAY = 86_400_000;

/**
 * Burndown for a sprint (the active one by default, else the latest completed). Today's point
 * is measured live, so the chart is current even if the worker hasn't run yet.
 */
export async function getBurndown(projectId: string, sprintId?: string) {
  const sprints = await db.sprint.findMany({
    where: { projectId, state: { in: ["active", "completed"] } },
    orderBy: [{ startedAt: "desc" }],
    take: 12,
    select: {
      id: true,
      name: true,
      state: true,
      startDate: true,
      endDate: true,
      startedAt: true,
      completedAt: true,
      committedPoints: true,
    },
  });
  const sprint =
    sprints.find((s) => s.id === sprintId) ??
    sprints.find((s) => s.state === "active") ??
    sprints[0];
  if (!sprint) return { sprint: null, sprints, points: [] };
  const start = sprint.startDate ?? sprint.startedAt ?? new Date();
  const end = sprint.endDate ?? sprint.completedAt ?? new Date(start.getTime() + 13 * DAY);
  const snapshots = await db.projectSnapshot.findMany({
    where: { sprintId: sprint.id },
    orderBy: { date: "asc" },
    select: { date: true, sprintRemaining: true, sprintScope: true },
  });
  const rows = snapshots.map((s) => ({
    date: isoDay(s.date),
    remaining: s.sprintRemaining,
    scope: s.sprintScope,
  }));
  const today = new Date();
  if (sprint.state === "active") {
    const live = await measureProject(projectId);
    const todayKey = isoDay(today);
    const existing = rows.findIndex((r) => r.date === todayKey);
    const row = { date: todayKey, remaining: live.sprintRemaining, scope: live.sprintScope };
    if (existing >= 0) rows[existing] = row;
    else rows.push(row);
  }
  if (!rows.length && sprint.committedPoints !== null) {
    rows.push({
      date: isoDay(start),
      remaining: sprint.committedPoints,
      scope: sprint.committedPoints,
    });
  }
  return {
    sprint: {
      id: sprint.id,
      name: sprint.name,
      state: sprint.state,
      start: isoDay(start),
      end: isoDay(end),
    },
    sprints: sprints.map((s) => ({ id: s.id, name: s.name, state: s.state })),
    points: burndown({
      start,
      end,
      today: sprint.state === "active" ? today : end,
      snapshots: rows,
    }),
  };
}

/** Committed vs completed points for the last completed sprints, oldest first. */
export async function getVelocity(projectId: string, limit = 8): Promise<VelocityPoint[]> {
  const sprints = await db.sprint.findMany({
    where: { projectId, state: "completed" },
    orderBy: { completedAt: "desc" },
    take: limit,
    select: { name: true, committedPoints: true, completedPoints: true },
  });
  return sprints.reverse().map((s) => ({
    sprint: s.name,
    committed: s.committedPoints ?? 0,
    completed: s.completedPoints ?? 0,
  }));
}

/** Cumulative flow over the last `days`, today measured live. */
export async function getFlow(projectId: string, days = 30) {
  const end = new Date();
  const start = new Date(end.getTime() - (days - 1) * DAY);
  const snapshots = await db.projectSnapshot.findMany({
    where: { projectId, date: { gte: new Date(isoDay(start)) } },
    orderBy: { date: "asc" },
    select: { date: true, todoCount: true, inProgressCount: true, doneCount: true },
  });
  const rows = snapshots.map((s) => ({
    date: isoDay(s.date),
    todo: s.todoCount,
    inProgress: s.inProgressCount,
    done: s.doneCount,
  }));
  const live = await measureProject(projectId);
  const todayKey = isoDay(end);
  const row = {
    date: todayKey,
    todo: live.todoCount,
    inProgress: live.inProgressCount,
    done: live.doneCount,
  };
  const at = rows.findIndex((r) => r.date === todayKey);
  if (at >= 0) rows[at] = row;
  else rows.push(row);
  return cumulativeFlow({ start, end, snapshots: rows });
}

/** Created vs resolved per day for any set of issues (a project or a TQL filter). */
export async function getCreatedResolved(where: Prisma.IssueWhereInput, days = 30) {
  const end = new Date();
  const start = new Date(new Date(isoDay(new Date(end.getTime() - (days - 1) * DAY))).getTime());
  const [created, resolved] = await Promise.all([
    db.issue.findMany({
      where: { AND: [where, { createdAt: { gte: start } }] },
      select: { createdAt: true },
      take: 20_000,
    }),
    db.issue.findMany({
      where: { AND: [where, { resolvedAt: { gte: start } }] },
      select: { resolvedAt: true },
      take: 20_000,
    }),
  ]);
  return createdVsResolved({
    start,
    end,
    created: created.map((i) => i.createdAt),
    resolved: resolved.map((i) => i.resolvedAt!),
  });
}

export const BREAKDOWN_FIELDS = [
  "status",
  "statusCategory",
  "priority",
  "assignee",
  "type",
  "resolution",
  "label",
] as const;
export type BreakdownField = (typeof BREAKDOWN_FIELDS)[number];
export const BREAKDOWN_LABELS: Record<BreakdownField, string> = {
  status: "Status",
  statusCategory: "Status category",
  priority: "Priority",
  assignee: "Assignee",
  type: "Type",
  resolution: "Resolution",
  label: "Label",
};

/** Issue counts grouped by one field, largest first (priorities keep their order). */
export async function getBreakdown(where: Prisma.IssueWhereInput, field: BreakdownField) {
  const issues = await db.issue.findMany({
    where,
    take: 20_000,
    select: {
      priority: true,
      type: true,
      status: { select: { name: true, category: true } },
      assignee: { select: { name: true } },
      resolution: { select: { name: true } },
      labels: { select: { label: { select: { name: true } } } },
    },
  });
  const counts = new Map<string, number>();
  const add = (key: string) => counts.set(key, (counts.get(key) ?? 0) + 1);
  for (const issue of issues) {
    switch (field) {
      case "status":
        add(issue.status.name);
        break;
      case "statusCategory":
        add(STATUS_CATEGORY_LABELS[issue.status.category]);
        break;
      case "priority":
        add(PRIORITY_LABELS[issue.priority]);
        break;
      case "assignee":
        add(issue.assignee?.name ?? "Unassigned");
        break;
      case "type":
        add(ISSUE_TYPE_LABELS[issue.type]);
        break;
      case "resolution":
        add(issue.resolution?.name ?? "Unresolved");
        break;
      case "label": {
        const labels = issue.labels;
        if (!labels.length) add("No label");
        for (const l of labels) add(l.label.name);
        break;
      }
    }
  }
  const rows = [...counts.entries()].map(([name, count]) => ({ name, count }));
  if (field === "priority") {
    const order = [...PRIORITIES].reverse().map((p) => PRIORITY_LABELS[p]);
    return rows.sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name));
  }
  return rows.sort((a, b) => b.count - a.count);
}

/**
 * Workload: open work per person (issues and points by category) and time logged this week,
 * across the workspace or one project.
 */
export async function getWorkload(workspaceId: string, projectId?: string, weekStart?: Date) {
  const scope = { workspaceId, ...(projectId ? { projectId } : {}), project: { archivedAt: null } };
  const [members, issues, logged] = await Promise.all([
    db.workspaceMember.findMany({
      where: { workspaceId, role: { not: "guest" } },
      select: { user: { select: { id: true, name: true, image: true } } },
    }),
    db.issue.findMany({
      where: { ...scope, status: { category: { not: "done" } }, type: { not: "epic" } },
      select: {
        assigneeId: true,
        estimate: true,
        dueDate: true,
        status: { select: { category: true } },
      },
    }),
    weekStart
      ? db.worklog.groupBy({
          by: ["userId"],
          where: {
            date: { gte: weekStart, lt: new Date(weekStart.getTime() + 7 * DAY) },
            issue: scope,
          },
          _sum: { minutes: true },
        })
      : Promise.resolve([]),
  ]);
  const today = new Date(isoDay(new Date()));
  const rows = [...members.map((m) => m.user), null].map((user) => {
    const mine = issues.filter((i) => i.assigneeId === (user?.id ?? null));
    return {
      user,
      todo: mine.filter((i) => i.status.category === "todo").length,
      inProgress: mine.filter((i) => i.status.category === "in_progress").length,
      points: mine.reduce((s, i) => s + (i.estimate ?? 0), 0),
      overdue: mine.filter((i) => i.dueDate && i.dueDate < today).length,
      loggedMinutes: logged.find((l) => l.userId === (user?.id ?? null))?._sum.minutes ?? 0,
    };
  });
  return (
    rows
      // People with nothing open and nothing logged would just be noise.
      .filter((r) => r.todo || r.inProgress || r.loggedMinutes)
      .sort((a, b) => b.todo + b.inProgress - (a.todo + a.inProgress))
  );
}

export type WorkloadRow = Awaited<ReturnType<typeof getWorkload>>[number];
