import "server-only";
import {
  AppError,
  nextRun,
  type IssueType,
  type Priority,
  type RecurrenceFrequency,
} from "@tracklane/core";
import { db } from "@tracklane/db";
import { createIssue } from "@/features/issues/server/service";
import { assertWorkspacePermission } from "@/server/authz";

export interface RecurringInput {
  title: string;
  description: string;
  type: IssueType;
  priority: Priority;
  assigneeId: string | null;
  frequency: RecurrenceFrequency;
  days: number[];
  dueInDays: number | null;
}

export function listRecurring(projectId: string) {
  return db.recurringIssue.findMany({
    where: { projectId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      title: true,
      description: true,
      type: true,
      priority: true,
      assigneeId: true,
      frequency: true,
      days: true,
      dueInDays: true,
      enabled: true,
      nextRunAt: true,
      lastRunAt: true,
    },
  });
}

function normalizeDays(frequency: RecurrenceFrequency, days: number[]) {
  if (frequency === "daily") return [];
  if (frequency === "monthly") return [Math.min(31, Math.max(1, days[0] ?? 1))];
  const week = [...new Set(days.filter((d) => d >= 1 && d <= 7))].sort();
  if (!week.length)
    throw new AppError("validation_failed", "Pick at least one weekday", { field: "days" });
  return week;
}

export async function saveRecurring(
  workspaceId: string,
  projectId: string,
  userId: string,
  id: string | null,
  input: RecurringInput,
) {
  await assertWorkspacePermission(workspaceId, userId, "projects:update");
  const project = await db.project.findFirst({
    where: { id: projectId, workspaceId },
    select: { id: true },
  });
  if (!project) throw new AppError("not_found", "Project not found");
  if (input.assigneeId) {
    const member = await db.workspaceMember.count({
      where: { workspaceId, userId: input.assigneeId },
    });
    if (!member) throw new AppError("validation_failed", "The assignee isn't a workspace member");
  }
  const days = normalizeDays(input.frequency, input.days);
  const data = {
    ...input,
    days,
    // Recurring issues are created as whoever last saved them.
    createdById: userId,
    nextRunAt: nextRun(input.frequency, days, new Date()),
  };
  if (id) {
    const { count } = await db.recurringIssue.updateMany({ where: { id, projectId }, data });
    if (!count) throw new AppError("not_found", "Recurring issue not found");
    return { id, title: input.title };
  }
  return db.recurringIssue.create({
    data: { ...data, projectId },
    select: { id: true, title: true },
  });
}

export async function setRecurringEnabled(
  workspaceId: string,
  projectId: string,
  userId: string,
  id: string,
  enabled: boolean,
) {
  await assertWorkspacePermission(workspaceId, userId, "projects:update");
  const row = await db.recurringIssue.findFirst({
    where: { id, projectId, project: { workspaceId } },
  });
  if (!row) throw new AppError("not_found", "Recurring issue not found");
  await db.recurringIssue.update({
    where: { id },
    // Re-enabling starts from today, rather than catching up on missed runs.
    data: {
      enabled,
      ...(enabled ? { nextRunAt: nextRun(row.frequency, row.days, new Date()) } : {}),
    },
  });
}

export async function deleteRecurring(
  workspaceId: string,
  projectId: string,
  userId: string,
  id: string,
) {
  await assertWorkspacePermission(workspaceId, userId, "projects:update");
  const { count } = await db.recurringIssue.deleteMany({
    where: { id, projectId, project: { workspaceId } },
  });
  if (!count) throw new AppError("not_found", "Recurring issue not found");
}

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

/** Creates one issue for each recurring issue that is due. Returns how many were created. */
export async function runDueRecurringIssues(now = new Date()) {
  const due = await db.recurringIssue.findMany({
    where: { enabled: true, nextRunAt: { lte: now }, project: { archivedAt: null } },
    include: { project: { select: { workspaceId: true } } },
    take: 200,
  });
  let created = 0;
  for (const r of due) {
    // Claim it first, so two overlapping runs can't both create the issue.
    const { count } = await db.recurringIssue.updateMany({
      where: { id: r.id, nextRunAt: r.nextRunAt },
      data: { nextRunAt: nextRun(r.frequency, r.days, now), lastRunAt: now },
    });
    if (!count || !r.createdById) continue;
    try {
      await createIssue({
        workspaceId: r.project.workspaceId,
        projectId: r.projectId,
        userId: r.createdById,
        title: r.title,
        description: r.description,
        type: r.type,
        priority: r.priority,
        assigneeId: r.assigneeId,
        dueDate:
          r.dueInDays === null ? null : isoDate(new Date(now.getTime() + r.dueInDays * 86_400_000)),
        source: "automation",
      });
      created++;
    } catch (error) {
      console.warn(`Could not create recurring issue ${r.id}`, error);
    }
  }
  return created;
}
