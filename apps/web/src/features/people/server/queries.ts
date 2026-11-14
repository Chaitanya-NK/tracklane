import "server-only";
import { AppError, formatIssueKey } from "@tracklane/core";
import { db } from "@tracklane/db";
import { issueListSelect } from "@/features/issues/server";

const DAY = 86_400_000;

/** A workspace member's profile. Only people in the same workspace can see it. */
export async function getProfile(workspaceId: string, userId: string) {
  const member = await db.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    select: {
      role: true,
      createdAt: true,
      lastActiveAt: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          jobTitle: true,
          department: true,
          location: true,
          timezone: true,
          bio: true,
          createdAt: true,
        },
      },
    },
  });
  if (!member) throw new AppError("not_found", "This person isn't in the workspace");
  const since = new Date(Date.now() - 30 * DAY);
  const scope = { workspaceId, project: { archivedAt: null } };
  const [open, inProgress, resolved, comments] = await Promise.all([
    db.issue.count({
      where: { ...scope, assigneeId: userId, status: { category: { not: "done" } } },
    }),
    db.issue.count({
      where: { ...scope, assigneeId: userId, status: { category: "in_progress" } },
    }),
    db.issue.count({
      where: { ...scope, assigneeId: userId, resolvedAt: { gte: since } },
    }),
    db.comment.count({
      where: { authorId: userId, createdAt: { gte: since }, issue: scope },
    }),
  ]);
  return {
    ...member.user,
    role: member.role,
    joinedAt: member.createdAt,
    lastActiveAt: member.lastActiveAt,
    stats: { open, inProgress, resolved, comments },
  };
}

export type Profile = Awaited<ReturnType<typeof getProfile>>;

/** Open issues assigned to the person, most urgent first. */
export function getProfileWork(workspaceId: string, userId: string) {
  return db.issue.findMany({
    where: {
      workspaceId,
      project: { archivedAt: null },
      assigneeId: userId,
      status: { category: { not: "done" } },
    },
    orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { updatedAt: "desc" }],
    take: 50,
    select: issueListSelect,
  });
}

/** What the person changed recently. */
export async function getProfileActivity(workspaceId: string, userId: string) {
  const rows = await db.issueActivity.findMany({
    where: { actorId: userId, issue: { workspaceId, project: { archivedAt: null } } },
    orderBy: { createdAt: "desc" },
    take: 40,
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
  return rows.map((r) => ({ ...r, key: formatIssueKey(r.issue.project.key, r.issue.number) }));
}

/** Projects the person leads or has issues in, with their open-issue count. */
export async function getProfileProjects(workspaceId: string, userId: string) {
  const projects = await db.project.findMany({
    where: {
      workspaceId,
      archivedAt: null,
      OR: [
        { leadId: userId },
        { issues: { some: { OR: [{ assigneeId: userId }, { reporterId: userId }] } } },
      ],
    },
    orderBy: { name: "asc" },
    take: 50,
    select: {
      id: true,
      key: true,
      name: true,
      type: true,
      leadId: true,
      _count: {
        select: {
          issues: { where: { assigneeId: userId, status: { category: { not: "done" } } } },
        },
      },
    },
  });
  return projects.map((p) => ({
    id: p.id,
    key: p.key,
    name: p.name,
    type: p.type,
    lead: p.leadId === userId,
    openAssigned: p._count.issues,
  }));
}

/** True when both people belong to at least one common workspace. */
export async function sharesWorkspace(viewerId: string, userId: string) {
  if (viewerId === userId) return true;
  const shared = await db.workspaceMember.findFirst({
    where: { userId, workspace: { members: { some: { userId: viewerId } } } },
    select: { id: true },
  });
  return !!shared;
}

/** Name, email and photo straight from the database (the session copy can be a minute old). */
export function getUserCard(userId: string) {
  return db.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true, image: true },
  });
}
