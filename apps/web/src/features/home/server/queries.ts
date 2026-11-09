import "server-only";
import { formatIssueKey } from "@tracklane/core";
import { db } from "@tracklane/db";
import { issueListSelect } from "@/features/issues/server";

export type HomeTab = "assigned" | "worked" | "viewed" | "starred";

const DAY = 86_400_000;

/** Issues for the home tabs. */
export async function getHomeIssues(workspaceId: string, userId: string, tab: HomeTab) {
  const scope = { workspaceId, project: { archivedAt: null } };
  if (tab === "worked") {
    return db.issue.findMany({
      where: {
        ...scope,
        activities: {
          some: { actorId: userId, createdAt: { gte: new Date(Date.now() - 14 * DAY) } },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 25,
      select: issueListSelect,
    });
  }
  if (tab === "viewed" || tab === "starred") {
    const rows =
      tab === "viewed"
        ? await db.issueView.findMany({
            where: { userId, issue: scope },
            orderBy: { viewedAt: "desc" },
            take: 25,
            select: { issue: { select: issueListSelect } },
          })
        : await db.issueStar.findMany({
            where: { userId, issue: scope },
            orderBy: { createdAt: "desc" },
            take: 50,
            select: { issue: { select: issueListSelect } },
          });
    return rows.map((r) => r.issue);
  }
  return db.issue.findMany({
    where: { ...scope, assigneeId: userId, status: { category: { not: "done" } } },
    orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { updatedAt: "desc" }],
    take: 25,
    select: issueListSelect,
  });
}

/** The soonest-ending active sprint the user has work in (for the greeting). */
export async function getMySprint(workspaceId: string, userId: string) {
  const sprint = await db.sprint.findFirst({
    where: {
      state: "active",
      project: { workspaceId, archivedAt: null },
      issues: { some: { assigneeId: userId } },
    },
    orderBy: { endDate: { sort: "asc", nulls: "last" } },
    select: { name: true, endDate: true, project: { select: { key: true } } },
  });
  if (!sprint) return null;
  return {
    name: sprint.name,
    projectKey: sprint.project.key,
    daysLeft: sprint.endDate
      ? Math.max(0, Math.ceil((sprint.endDate.getTime() - Date.now()) / DAY))
      : null,
  };
}

/** Projects with recent activity, most recent first, with their progress. */
export async function getRecentProjects(workspaceId: string, userId: string) {
  const projects = await db.project.findMany({
    where: { workspaceId, archivedAt: null },
    select: {
      id: true,
      key: true,
      name: true,
      stars: { where: { userId }, select: { userId: true } },
      issues: {
        orderBy: { updatedAt: "desc" },
        take: 1,
        select: { updatedAt: true },
      },
    },
  });
  const recent = projects
    .sort(
      (a, b) =>
        Number(b.stars.length > 0) - Number(a.stars.length > 0) ||
        (b.issues[0]?.updatedAt.getTime() ?? 0) - (a.issues[0]?.updatedAt.getTime() ?? 0),
    )
    .slice(0, 5);
  const counts = await db.issue.groupBy({
    by: ["projectId", "statusId"],
    where: { projectId: { in: recent.map((p) => p.id) }, type: { not: "epic" } },
    _count: { _all: true },
  });
  const statuses = await db.workflowStatus.findMany({
    where: { projectId: { in: recent.map((p) => p.id) } },
    select: { id: true, category: true },
  });
  const done = new Set(statuses.filter((s) => s.category === "done").map((s) => s.id));
  return recent.map((p) => {
    const rows = counts.filter((c) => c.projectId === p.id);
    const total = rows.reduce((s, r) => s + r._count._all, 0);
    const finished = rows
      .filter((r) => done.has(r.statusId))
      .reduce((s, r) => s + r._count._all, 0);
    return {
      key: p.key,
      name: p.name,
      starred: p.stars.length > 0,
      total,
      done: finished,
      updatedAt: p.issues[0]?.updatedAt ?? null,
    };
  });
}

/** Latest changes across the workspace. */
export async function getActivityFeed(workspaceId: string) {
  const rows = await db.issueActivity.findMany({
    where: { issue: { workspaceId, project: { archivedAt: null } } },
    orderBy: { createdAt: "desc" },
    take: 12,
    select: {
      id: true,
      action: true,
      field: true,
      fromValue: true,
      toValue: true,
      createdAt: true,
      actor: { select: { id: true, name: true, image: true } },
      issue: { select: { number: true, title: true, project: { select: { key: true } } } },
    },
  });
  return rows.map((r) => ({
    ...r,
    key: formatIssueKey(r.issue.project.key, r.issue.number),
  }));
}
