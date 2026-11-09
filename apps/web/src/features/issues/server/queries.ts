import "server-only";
import { parseIssueKey, PRIORITIES } from "@tracklane/core";
import { db, type Prisma } from "@tracklane/db";
import type { IssueFilters } from "../filters";

/** Columns shown wherever issues are listed (project list, home, subtasks). */
export const issueListSelect = {
  id: true,
  number: true,
  title: true,
  type: true,
  priority: true,
  dueDate: true,
  estimate: true,
  updatedAt: true,
  createdAt: true,
  project: { select: { key: true, name: true } },
  status: { select: { id: true, name: true, category: true } },
  assignee: { select: { id: true, name: true, image: true } },
  labels: { select: { label: { select: { id: true, name: true, color: true } } } },
  customType: { select: { name: true, color: true, icon: true } },
} satisfies Prisma.IssueSelect;

export type IssueListRow = Prisma.IssueGetPayload<{ select: typeof issueListSelect }>;

const MAX_LIST = 500;

export async function listProjectIssues(
  projectId: string,
  userId: string,
  filters: IssueFilters,
): Promise<{ issues: IssueListRow[]; truncated: boolean }> {
  const where: Prisma.IssueWhereInput = { projectId };
  if (filters.statusIds.length) where.statusId = { in: filters.statusIds };
  if (filters.types.length) where.type = { in: filters.types };
  if (filters.priorities.length) where.priority = { in: filters.priorities };
  if (filters.assignee === "me") where.assigneeId = userId;
  else if (filters.assignee === "none") where.assigneeId = null;
  else if (filters.assignee) where.assigneeId = filters.assignee;
  if (filters.q) {
    const key = parseIssueKey(filters.q);
    const number = /^\d+$/.test(filters.q) ? Number(filters.q) : key?.number;
    where.OR = [
      { title: { contains: filters.q, mode: "insensitive" } },
      ...(number ? [{ number }] : []),
    ];
  }

  const orderBy: Prisma.IssueOrderByWithRelationInput[] =
    filters.sort === "created"
      ? [{ createdAt: "desc" }]
      : filters.sort === "key"
        ? [{ number: "desc" }]
        : [{ updatedAt: "desc" }];

  let issues = await db.issue.findMany({
    where,
    orderBy,
    take: MAX_LIST + 1,
    select: issueListSelect,
  });
  const truncated = issues.length > MAX_LIST;
  issues = issues.slice(0, MAX_LIST);
  if (filters.sort === "priority") {
    // Enum order in the DB is lowest → highest; sort in memory to keep it explicit.
    const rank = (p: string) => PRIORITIES.indexOf(p as (typeof PRIORITIES)[number]);
    issues.sort((a, b) => rank(b.priority) - rank(a.priority) || b.number - a.number);
  }
  return { issues, truncated };
}

/** Everything the issue page needs, by key ("PAY-12"). Null if it doesn't exist. */
export async function getIssueByKey(workspaceId: string, issueKey: string) {
  const parsed = parseIssueKey(issueKey);
  if (!parsed) return null;
  return db.issue.findFirst({
    where: { workspaceId, number: parsed.number, project: { key: parsed.projectKey } },
    select: {
      id: true,
      number: true,
      title: true,
      description: true,
      type: true,
      priority: true,
      startDate: true,
      dueDate: true,
      estimate: true,
      resolvedAt: true,
      resolutionId: true,
      releaseId: true,
      customTypeId: true,
      customType: { select: { name: true, color: true, icon: true } },
      workspaceId: true,
      resolution: { select: { name: true } },
      createdAt: true,
      updatedAt: true,
      statusId: true,
      project: { select: { id: true, key: true, name: true, type: true } },
      sprintId: true,
      status: { select: { id: true, name: true, category: true } },
      assignee: { select: { id: true, name: true, email: true, image: true } },
      reporter: { select: { id: true, name: true, image: true } },
      parent: { select: { id: true, number: true, title: true, type: true } },
      labels: { select: { label: { select: { id: true, name: true, color: true } } } },
      children: { orderBy: { number: "asc" }, select: issueListSelect },
    },
  });
}

export type IssueDetail = NonNullable<Awaited<ReturnType<typeof getIssueByKey>>>;

export function listComments(issueId: string) {
  return db.comment.findMany({
    where: { issueId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      body: true,
      editedAt: true,
      createdAt: true,
      author: { select: { id: true, name: true, image: true } },
    },
  });
}

export function listAttachments(issueId: string) {
  return db.attachment.findMany({
    where: { issueId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      filename: true,
      contentType: true,
      size: true,
      createdAt: true,
      uploader: { select: { id: true, name: true } },
    },
  });
}

export function listActivity(issueId: string) {
  return db.issueActivity.findMany({
    where: { issueId },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      action: true,
      field: true,
      fromValue: true,
      toValue: true,
      createdAt: true,
      actor: { select: { id: true, name: true, image: true } },
    },
  });
}

/** Issues that can be the parent of an issue of `childType`, for the parent picker. */
export function listParentCandidates(
  projectId: string,
  parentTypes: readonly string[],
  excludeId?: string,
) {
  if (parentTypes.length === 0) return Promise.resolve([]);
  return db.issue.findMany({
    where: {
      projectId,
      type: { in: parentTypes as Prisma.EnumIssueTypeFilter["in"] },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    orderBy: { number: "desc" },
    take: 200,
    select: { id: true, number: true, title: true, type: true },
  });
}

/** The home page: open work assigned to the user, plus counts. */
export async function getMyWork(workspaceId: string, userId: string) {
  const now = new Date();
  const weekAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const open = { workspaceId, assigneeId: userId, status: { category: { not: "done" as const } } };

  const [issues, assignedOpen, dueSoon, reportedOpen, doneThisWeek] = await Promise.all([
    db.issue.findMany({
      where: open,
      orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { updatedAt: "desc" }],
      take: 25,
      select: issueListSelect,
    }),
    db.issue.count({ where: open }),
    db.issue.count({ where: { ...open, dueDate: { lte: weekAhead } } }),
    db.issue.count({
      where: { workspaceId, reporterId: userId, status: { category: { not: "done" } } },
    }),
    db.issue.count({ where: { workspaceId, assigneeId: userId, resolvedAt: { gte: weekAgo } } }),
  ]);
  return { issues, stats: { assignedOpen, dueSoon, reportedOpen, doneThisWeek } };
}
