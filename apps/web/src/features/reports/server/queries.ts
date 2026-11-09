import "server-only";
import { cycleStats } from "../cycle";
import { DAILY_CAPACITY, planWorkload, type WorkloadMetric } from "../workload-plan";
import {
  burndown,
  createdVsResolved,
  cumulativeFlow,
  formatIssueKey,
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
const breakdownSelect = {
  priority: true,
  type: true,
  status: { select: { name: true, category: true } },
  assignee: { select: { name: true } },
  resolution: { select: { name: true } },
  labels: { select: { label: { select: { name: true } } } },
} satisfies Prisma.IssueSelect;

type BreakdownIssue = Prisma.IssueGetPayload<{ select: typeof breakdownSelect }>;

/** The value(s) an issue has for a breakdown field (labels can have several). */
function valuesOf(issue: BreakdownIssue, field: BreakdownField): string[] {
  switch (field) {
    case "status":
      return [issue.status.name];
    case "statusCategory":
      return [STATUS_CATEGORY_LABELS[issue.status.category]];
    case "priority":
      return [PRIORITY_LABELS[issue.priority]];
    case "assignee":
      return [issue.assignee?.name ?? "Unassigned"];
    case "type":
      return [ISSUE_TYPE_LABELS[issue.type]];
    case "resolution":
      return [issue.resolution?.name ?? "Unresolved"];
    case "label":
      return issue.labels.length ? issue.labels.map((l) => l.label.name) : ["No label"];
  }
}

export async function getBreakdown(where: Prisma.IssueWhereInput, field: BreakdownField) {
  const issues = await db.issue.findMany({ where, take: 20_000, select: breakdownSelect });
  const counts = new Map<string, number>();
  for (const issue of issues) {
    for (const v of valuesOf(issue, field)) counts.set(v, (counts.get(v) ?? 0) + 1);
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

/** Scheduled work per person and working day, with time off, for the workload heatmap. */
export async function getWorkloadPlan(input: {
  workspaceId: string;
  from: string;
  days: string[];
  metric: WorkloadMetric;
}) {
  const last = input.days.at(-1)!;
  const [members, issues, timeOff] = await Promise.all([
    db.workspaceMember.findMany({
      where: { workspaceId: input.workspaceId, role: { not: "guest" } },
      select: { user: { select: { id: true, name: true, image: true } } },
      orderBy: { user: { name: "asc" } },
    }),
    db.issue.findMany({
      where: {
        workspaceId: input.workspaceId,
        project: { archivedAt: null },
        status: { category: { not: "done" } },
        type: { not: "epic" },
      },
      select: {
        assigneeId: true,
        startDate: true,
        dueDate: true,
        estimate: true,
        timeEstimate: true,
      },
    }),
    db.timeOff.findMany({
      where: {
        workspaceId: input.workspaceId,
        endDate: { gte: new Date(`${input.from}T00:00:00Z`) },
        startDate: { lte: new Date(`${last}T00:00:00Z`) },
      },
      select: { userId: true, startDate: true, endDate: true },
    }),
  ]);
  const planIssues = issues.map((i) => ({
    assigneeId: i.assigneeId,
    startDate: i.startDate ? isoDay(i.startDate) : null,
    dueDate: i.dueDate ? isoDay(i.dueDate) : null,
    points: i.estimate,
    timeEstimate: i.timeEstimate,
  }));
  const ranges = timeOff.map((t) => ({
    userId: t.userId,
    start: isoDay(t.startDate),
    end: isoDay(t.endDate),
  }));
  const people = members.map((m) => m.user);
  const rows = planWorkload({
    days: input.days,
    today: isoDay(new Date()),
    people: [...people.map((p) => p.id), null],
    issues: planIssues,
    timeOff: ranges,
    metric: input.metric,
  });
  const unassigned = rows.at(-1)!;
  const assigned = rows.slice(0, -1).map((row, i) => ({ ...row, user: people[i]! }));
  const capacity = DAILY_CAPACITY[input.metric];
  const availableDays = assigned.reduce((s, r) => s + r.cells.filter((c) => !c.off).length, 0);
  const scheduled = assigned.reduce((s, r) => s + r.total, 0);
  return {
    rows: assigned,
    unassigned: {
      total: unassigned.total + unassigned.unscheduled,
      issues: issues.filter((i) => !i.assigneeId).length,
    },
    stats: {
      utilization: capacity
        ? Math.round((scheduled / (availableDays * capacity || 1)) * 100)
        : null,
      overCapacity: assigned.filter((r) => r.cells.some((c) => c.over)).length,
      onTimeOff: new Set(ranges.map((r) => r.userId)).size,
    },
  };
}

export type WorkloadPlan = Awaited<ReturnType<typeof getWorkloadPlan>>;

/** Sprint report: committed vs completed, scope added, and the work left undone. */
export async function getSprintReport(projectId: string, sprintId: string) {
  const sprint = await db.sprint.findFirst({
    where: { id: sprintId, projectId },
    select: {
      id: true,
      name: true,
      state: true,
      committedPoints: true,
      completedPoints: true,
      issues: {
        where: { type: { notIn: ["epic", "subtask"] } },
        orderBy: { number: "asc" },
        select: {
          id: true,
          number: true,
          title: true,
          type: true,
          estimate: true,
          priority: true,
          status: { select: { name: true, category: true } },
          assignee: { select: { name: true, image: true } },
          project: { select: { key: true } },
        },
      },
    },
  });
  if (!sprint) return null;
  const done = sprint.issues.filter((i) => i.status.category === "done");
  const open = sprint.issues.filter((i) => i.status.category !== "done");
  const points = (list: typeof sprint.issues) => list.reduce((s, i) => s + (i.estimate ?? 0), 0);
  return {
    name: sprint.name,
    state: sprint.state,
    committed: { points: sprint.committedPoints, issues: null as number | null },
    completed: {
      points:
        sprint.state === "completed" ? (sprint.completedPoints ?? points(done)) : points(done),
      issues: done.length,
    },
    open: { points: points(open), issues: open.length },
    notCompleted: open.map((i) => ({
      id: i.id,
      key: formatIssueKey(i.project.key, i.number),
      title: i.title,
      type: i.type,
      priority: i.priority,
      estimate: i.estimate,
      status: i.status,
      assignee: i.assignee,
    })),
  };
}

export type SprintReport = NonNullable<Awaited<ReturnType<typeof getSprintReport>>>;

/**
 * Cycle time of issues resolved in the last `days`: from first entering an In progress
 * status (or creation, if never) to resolution.
 */
export async function getCycleTime(projectId: string, days: number) {
  const since = new Date(Date.now() - days * DAY);
  const [issues, statuses] = await Promise.all([
    db.issue.findMany({
      where: { projectId, resolvedAt: { gte: since }, type: { not: "epic" } },
      orderBy: { resolvedAt: "desc" },
      take: 1000,
      select: {
        id: true,
        number: true,
        title: true,
        createdAt: true,
        resolvedAt: true,
        project: { select: { key: true } },
        activities: {
          where: { field: "status" },
          orderBy: { createdAt: "asc" },
          select: { toValue: true, createdAt: true },
        },
      },
    }),
    db.workflowStatus.findMany({
      where: { projectId, category: "in_progress" },
      select: { name: true },
    }),
  ]);
  const working = new Set(statuses.map((s) => s.name));
  const rows = issues.map((i) => {
    const started =
      i.activities.find((a) => a.toValue && working.has(a.toValue))?.createdAt ?? i.createdAt;
    const cycleDays = Math.max(0, (i.resolvedAt!.getTime() - started.getTime()) / DAY);
    return {
      key: formatIssueKey(i.project.key, i.number),
      title: i.title,
      started: isoDay(started),
      resolved: isoDay(i.resolvedAt!),
      days: Math.round(cycleDays * 10) / 10,
    };
  });
  return { rows, stats: cycleStats(rows.map((r) => r.days)) };
}

export type CycleTime = Awaited<ReturnType<typeof getCycleTime>>;

/** Issue counts by two fields (rows × columns), e.g. assignee × status. */
export async function getMatrix(
  where: Prisma.IssueWhereInput,
  rowField: BreakdownField,
  columnField: BreakdownField,
) {
  const issues = await db.issue.findMany({ where, take: 20_000, select: breakdownSelect });
  const cells = new Map<string, Map<string, number>>();
  const columns = new Map<string, number>();
  for (const issue of issues) {
    for (const r of valuesOf(issue, rowField)) {
      const row = cells.get(r) ?? new Map<string, number>();
      for (const c of valuesOf(issue, columnField)) {
        row.set(c, (row.get(c) ?? 0) + 1);
        columns.set(c, (columns.get(c) ?? 0) + 1);
      }
      cells.set(r, row);
    }
  }
  const columnNames = [...columns.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);
  const rows = [...cells.entries()]
    .map(([name, row]) => ({
      name,
      counts: columnNames.map((c) => row.get(c) ?? 0),
      total: [...row.values()].reduce((a, b) => a + b, 0),
    }))
    .sort((a, b) => b.total - a.total);
  return { columns: columnNames, rows };
}

/** Activity per day over the last `weeks` weeks for issues matching `where`. */
export async function getActivityHeatmap(where: Prisma.IssueWhereInput, weeks = 12) {
  const end = new Date(isoDay(new Date()));
  const start = new Date(end.getTime() - (weeks * 7 - 1) * DAY);
  const rows = await db.issueActivity.findMany({
    where: { createdAt: { gte: start }, issue: where },
    select: { createdAt: true },
    take: 50_000,
  });
  const counts = new Map<string, number>();
  for (const r of rows) {
    const day = isoDay(r.createdAt);
    counts.set(day, (counts.get(day) ?? 0) + 1);
  }
  const days = Array.from({ length: weeks * 7 }, (_, i) => {
    const date = isoDay(new Date(start.getTime() + i * DAY));
    return { date, count: counts.get(date) ?? 0 };
  });
  return { days, total: rows.length };
}

/** The latest resolved issues matching `where`. */
export async function getRecentlyResolved(where: Prisma.IssueWhereInput, limit: number) {
  const issues = await db.issue.findMany({
    where: { AND: [where, { resolvedAt: { not: null } }] },
    orderBy: { resolvedAt: "desc" },
    take: limit,
    select: {
      id: true,
      number: true,
      title: true,
      type: true,
      resolvedAt: true,
      project: { select: { key: true } },
      assignee: { select: { name: true, image: true } },
      resolution: { select: { name: true } },
    },
  });
  return issues.map((i) => ({ ...i, key: formatIssueKey(i.project.key, i.number) }));
}

/** Active sprint at a glance: time used vs work done, scope added, flagged and blocked work. */
export async function getSprintHealth(projectId: string) {
  const sprint = await db.sprint.findFirst({
    where: { projectId, state: "active" },
    select: {
      id: true,
      name: true,
      startDate: true,
      endDate: true,
      startedAt: true,
      committedPoints: true,
      issues: {
        where: { type: { notIn: ["epic", "subtask"] } },
        select: {
          estimate: true,
          flagged: true,
          status: { select: { category: true } },
          linksIn: {
            where: { type: "blocks", source: { status: { category: { not: "done" } } } },
            select: { id: true },
          },
        },
      },
    },
  });
  if (!sprint) return null;
  const start = (sprint.startDate ?? sprint.startedAt ?? new Date()).getTime();
  const end = (sprint.endDate ?? new Date(start + 14 * DAY)).getTime();
  const now = Date.now();
  const points = sprint.issues.reduce((s, i) => s + (i.estimate ?? 0), 0);
  const done = sprint.issues
    .filter((i) => i.status.category === "done")
    .reduce((s, i) => s + (i.estimate ?? 0), 0);
  return {
    name: sprint.name,
    timePct: Math.round(Math.min(1, Math.max(0, (now - start) / (end - start || 1))) * 100),
    workPct: points ? Math.round((done / points) * 100) : 0,
    daysLeft: Math.max(0, Math.ceil((end - now) / DAY)),
    points,
    done,
    scopeAdded:
      sprint.committedPoints !== null ? Math.max(0, points - sprint.committedPoints) : null,
    flagged: sprint.issues.filter((i) => i.flagged && i.status.category !== "done").length,
    blocked: sprint.issues.filter((i) => i.linksIn.length && i.status.category !== "done").length,
  };
}
