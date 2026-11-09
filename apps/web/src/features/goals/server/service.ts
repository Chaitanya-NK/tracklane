import "server-only";
import { AppError, can, formatIssueKey, parseIssueKey } from "@tracklane/core";
import { db, Prisma } from "@tracklane/db";
import { issueListSelect } from "@/features/issues/server";
import { assertWorkspacePermission } from "@/server/authz";

const GOAL_STATUSES = ["on_track", "at_risk", "off_track", "done"] as const;
export type GoalStatus = (typeof GOAL_STATUSES)[number];

const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

/**
 * Progress counts a goal's linked issues, and for linked epics their child issues instead of
 * the epic itself (the epic is done when its work is).
 */
async function progressFor(goalIds: string[]) {
  if (!goalIds.length) return new Map<string, { done: number; total: number }>();
  const rows = await db.$queryRaw<{ goal_id: string; done: bigint; total: bigint }[]>`
    with items as (
      select gi.goal_id, i.id, i.status_id from goal_issues gi
      join issues i on i.id = gi.issue_id
      where gi.goal_id in (${Prisma.join(goalIds)})
        and not (i.type = 'epic' and exists (select 1 from issues c where c.parent_id = i.id))
      union
      select gi.goal_id, c.id, c.status_id from goal_issues gi
      join issues e on e.id = gi.issue_id and e.type = 'epic'
      join issues c on c.parent_id = e.id
      where gi.goal_id in (${Prisma.join(goalIds)})
    )
    select items.goal_id,
      count(*) filter (where s.category = 'done') as done,
      count(*) as total
    from items join workflow_statuses s on s.id = items.status_id
    group by items.goal_id`;
  return new Map(rows.map((r) => [r.goal_id, { done: Number(r.done), total: Number(r.total) }]));
}

export async function listGoals(workspaceId: string) {
  const goals = await db.goal.findMany({
    where: { workspaceId },
    orderBy: [
      { status: "asc" },
      { targetDate: { sort: "asc", nulls: "last" } },
      { createdAt: "asc" },
    ],
    select: {
      id: true,
      name: true,
      description: true,
      status: true,
      targetDate: true,
      updatedAt: true,
      owner: { select: { id: true, name: true, image: true } },
      _count: { select: { issues: true } },
    },
  });
  const progress = await progressFor(goals.map((g) => g.id));
  return goals.map(({ _count, ...g }) => ({
    ...g,
    targetDate: iso(g.targetDate),
    linked: _count.issues,
    progress: progress.get(g.id) ?? { done: 0, total: 0 },
  }));
}

export type GoalItem = Awaited<ReturnType<typeof listGoals>>[number];

export async function getGoal(workspaceId: string, goalId: string) {
  const goal = await db.goal.findFirst({
    where: { id: goalId, workspaceId },
    select: {
      id: true,
      name: true,
      description: true,
      status: true,
      targetDate: true,
      ownerId: true,
      owner: { select: { id: true, name: true, image: true } },
      issues: {
        orderBy: { createdAt: "asc" },
        select: {
          issue: { select: { ...issueListSelect, _count: { select: { children: true } } } },
        },
      },
    },
  });
  if (!goal) return null;
  const progress = (await progressFor([goal.id])).get(goal.id) ?? { done: 0, total: 0 };
  return {
    ...goal,
    targetDate: iso(goal.targetDate),
    progress,
    issues: goal.issues.map((g) => g.issue),
  };
}

export interface GoalInput {
  name: string;
  description: string;
  status: GoalStatus;
  ownerId: string | null;
  targetDate: string | null;
}

async function checkOwner(workspaceId: string, ownerId: string | null) {
  if (!ownerId) return;
  const member = await db.workspaceMember.count({ where: { workspaceId, userId: ownerId } });
  if (!member) throw new AppError("validation_failed", "The owner isn't a workspace member");
}

export async function saveGoal(
  workspaceId: string,
  userId: string,
  goalId: string | null,
  input: GoalInput,
) {
  await assertWorkspacePermission(workspaceId, userId, "issues:update");
  await checkOwner(workspaceId, input.ownerId);
  const data = {
    ...input,
    targetDate: input.targetDate ? new Date(`${input.targetDate}T00:00:00Z`) : null,
  };
  if (goalId) {
    const { count } = await db.goal.updateMany({ where: { id: goalId, workspaceId }, data });
    if (!count) throw new AppError("not_found", "Goal not found");
    return { id: goalId, name: input.name };
  }
  return db.goal.create({ data: { ...data, workspaceId }, select: { id: true, name: true } });
}

export async function setGoalStatus(
  workspaceId: string,
  userId: string,
  goalId: string,
  status: GoalStatus,
) {
  await assertWorkspacePermission(workspaceId, userId, "issues:update");
  const { count } = await db.goal.updateMany({
    where: { id: goalId, workspaceId },
    data: { status },
  });
  if (!count) throw new AppError("not_found", "Goal not found");
}

/** The goal's owner or an admin. */
export async function deleteGoal(workspaceId: string, userId: string, goalId: string) {
  const goal = await db.goal.findFirst({
    where: { id: goalId, workspaceId },
    select: { ownerId: true },
  });
  if (!goal) throw new AppError("not_found", "Goal not found");
  const role = await assertWorkspacePermission(workspaceId, userId, "issues:update");
  if (goal.ownerId !== userId && !can(role, "projects:update")) {
    throw new AppError("forbidden", "Only the goal's owner or an admin can delete it");
  }
  await db.goal.delete({ where: { id: goalId } });
}

export async function linkGoalIssues(
  workspaceId: string,
  userId: string,
  goalId: string,
  keys: string[],
) {
  await assertWorkspacePermission(workspaceId, userId, "issues:update");
  const goal = await db.goal.findFirst({
    where: { id: goalId, workspaceId },
    select: { id: true },
  });
  if (!goal) throw new AppError("not_found", "Goal not found");
  const parsed = keys
    .map((k) => ({ raw: k.trim().toUpperCase(), key: parseIssueKey(k.trim()) }))
    .filter((k) => k.raw);
  const bad = parsed.filter((k) => !k.key).map((k) => k.raw);
  if (bad.length)
    throw new AppError("validation_failed", `Not issue keys: ${bad.join(", ")}`, { field: "keys" });
  const issues = await db.issue.findMany({
    where: {
      workspaceId,
      OR: parsed.map((k) => ({ number: k.key!.number, project: { key: k.key!.projectKey } })),
    },
    select: { id: true, number: true, project: { select: { key: true } } },
  });
  const found = new Set(issues.map((i) => formatIssueKey(i.project.key, i.number)));
  const missing = parsed.filter((k) => !found.has(k.raw)).map((k) => k.raw);
  if (missing.length)
    throw new AppError("validation_failed", `Not found: ${missing.join(", ")}`, { field: "keys" });
  const { count } = await db.goalIssue.createMany({
    data: issues.map((i) => ({ goalId, issueId: i.id })),
    skipDuplicates: true,
  });
  return count;
}

export async function unlinkGoalIssue(
  workspaceId: string,
  userId: string,
  goalId: string,
  issueId: string,
) {
  await assertWorkspacePermission(workspaceId, userId, "issues:update");
  await db.goalIssue.deleteMany({ where: { goalId, issueId, goal: { workspaceId } } });
}

export { GOAL_STATUSES };
