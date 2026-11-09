import "server-only";
import { AppError, can, formatDuration, type WorkspaceRole } from "@tracklane/core";
import { db } from "@tracklane/db";
import { publishIssueChanged } from "@/features/notifications/server/issue-events";
import { assertWorkspacePermission } from "@/server/authz";

const MAX_MINUTES = 24 * 60;

async function issueScope(issueId: string) {
  const issue = await db.issue.findUnique({
    where: { id: issueId },
    select: { id: true, workspaceId: true, projectId: true },
  });
  if (!issue) throw new AppError("not_found", "Issue not found");
  return issue;
}

function checkEntry(minutes: number, date: string) {
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > MAX_MINUTES) {
    throw new AppError("validation_failed", "Log between 1 minute and 24 hours per entry", {
      field: "minutes",
    });
  }
  const day = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(day.getTime()))
    throw new AppError("validation_failed", "Pick a date", { field: "date" });
  if (day.getTime() > Date.now() + 86_400_000) {
    throw new AppError("validation_failed", "You can't log time in the future", { field: "date" });
  }
  return day;
}

export async function logWork(input: {
  issueId: string;
  userId: string;
  minutes: number;
  date: string;
  note: string;
}) {
  const issue = await issueScope(input.issueId);
  await assertWorkspacePermission(issue.workspaceId, input.userId, "issues:update");
  const date = checkEntry(input.minutes, input.date);
  return db.$transaction(async (tx) => {
    const worklog = await tx.worklog.create({
      data: {
        issueId: issue.id,
        userId: input.userId,
        minutes: input.minutes,
        date,
        note: input.note,
      },
      select: { id: true },
    });
    await tx.issueActivity.create({
      data: {
        issueId: issue.id,
        actorId: input.userId,
        action: "work_logged",
        field: "time",
        toValue: formatDuration(input.minutes),
      },
    });
    await tx.issue.update({ where: { id: issue.id }, data: { updatedAt: new Date() } });
    await publishIssueChanged(tx, issue, input.userId);
    return worklog;
  });
}

/** People edit their own entries; admins (comments:moderate) can edit anyone's. */
async function editableWorklog(worklogId: string, userId: string) {
  const worklog = await db.worklog.findUnique({
    where: { id: worklogId },
    select: {
      id: true,
      userId: true,
      issue: { select: { id: true, workspaceId: true, projectId: true } },
    },
  });
  if (!worklog) throw new AppError("not_found", "Work log not found");
  const member = await db.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: worklog.issue.workspaceId, userId } },
    select: { role: true },
  });
  const role = member?.role as WorkspaceRole | undefined;
  const own = worklog.userId === userId && role && can(role, "issues:update");
  if (!own && !(role && can(role, "comments:moderate"))) {
    throw new AppError("forbidden", "You can only change your own time entries");
  }
  return worklog;
}

export async function updateWorklog(input: {
  worklogId: string;
  userId: string;
  minutes: number;
  date: string;
  note: string;
}) {
  const worklog = await editableWorklog(input.worklogId, input.userId);
  const date = checkEntry(input.minutes, input.date);
  await db.worklog.update({
    where: { id: worklog.id },
    data: { minutes: input.minutes, date, note: input.note },
  });
}

export async function deleteWorklog(input: { worklogId: string; userId: string }) {
  const worklog = await editableWorklog(input.worklogId, input.userId);
  await db.worklog.delete({ where: { id: worklog.id } });
}
