import "server-only";
import { AppError, can, formatIssueKey, parseIssueKey, type WorkspaceRole } from "@tracklane/core";
import { db } from "@tracklane/db";
import { assertWorkspacePermission } from "@/server/authz";
import { logWork } from "./service";

const DAY = 86_400_000;
const iso = (d: Date) => d.toISOString().slice(0, 10);

function mondayOf(date: string) {
  const d = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) throw new AppError("validation_failed", "Pick a valid week");
  return new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * DAY);
}

async function roleIn(workspaceId: string, userId: string): Promise<WorkspaceRole> {
  const m = await db.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    select: { role: true },
  });
  if (!m) throw new AppError("not_found", "Workspace not found");
  return m.role;
}

/** Submitted or approved weeks are locked until rejected. */
async function assertWeekOpen(workspaceId: string, userId: string, day: Date) {
  const weekStart = new Date(day.getTime() - ((day.getUTCDay() + 6) % 7) * DAY);
  const sub = await db.timesheetSubmission.findUnique({
    where: { workspaceId_userId_weekStart: { workspaceId, userId, weekStart } },
    select: { status: true },
  });
  if (sub && sub.status !== "rejected") {
    throw new AppError(
      "conflict",
      sub.status === "approved"
        ? "This week is approved and locked"
        : "This week is submitted — ask an admin to reject it to make changes",
    );
  }
}

/**
 * Sets the user's total time on an issue for one day (the timesheet grid): replaces their
 * entries for that day with one entry, or removes them for 0.
 */
export async function setDayTime(input: {
  userId: string;
  issueId: string;
  date: string;
  minutes: number;
}) {
  const issue = await db.issue.findUnique({
    where: { id: input.issueId },
    select: { id: true, workspaceId: true },
  });
  if (!issue) throw new AppError("not_found", "Issue not found");
  await assertWorkspacePermission(issue.workspaceId, input.userId, "issues:update");
  const day = new Date(`${input.date}T00:00:00Z`);
  await assertWeekOpen(issue.workspaceId, input.userId, day);
  const existing = await db.worklog.findMany({
    where: { issueId: issue.id, userId: input.userId, date: day },
    select: { id: true, billable: true, minutes: true },
  });
  const current = existing.reduce((s, w) => s + w.minutes, 0);
  if (current === input.minutes) return;
  await db.worklog.deleteMany({ where: { id: { in: existing.map((w) => w.id) } } });
  if (input.minutes > 0) {
    const created = await logWork({
      issueId: issue.id,
      userId: input.userId,
      minutes: input.minutes,
      date: input.date,
      note: "",
    });
    if (existing.length && !existing[0]!.billable) {
      await db.worklog.update({ where: { id: created.id }, data: { billable: false } });
    }
  }
}

/** Marks the user's time on an issue in a week as billable or internal. */
export async function setWeekBillable(input: {
  userId: string;
  workspaceId: string;
  issueId: string;
  week: string;
  billable: boolean;
}) {
  const start = mondayOf(input.week);
  await assertWeekOpen(input.workspaceId, input.userId, start);
  await db.worklog.updateMany({
    where: {
      issueId: input.issueId,
      userId: input.userId,
      issue: { workspaceId: input.workspaceId },
      date: { gte: start, lt: new Date(start.getTime() + 7 * DAY) },
    },
    data: { billable: input.billable },
  });
}

/** Copies last week's hours into this week's matching weekdays (past days only, empty cells). */
export async function copyLastWeek(input: { userId: string; workspaceId: string; week: string }) {
  const start = mondayOf(input.week);
  await assertWeekOpen(input.workspaceId, input.userId, start);
  const prevStart = new Date(start.getTime() - 7 * DAY);
  const [prev, current] = await Promise.all([
    db.worklog.findMany({
      where: {
        userId: input.userId,
        issue: { workspaceId: input.workspaceId },
        date: { gte: prevStart, lt: start },
      },
      select: { issueId: true, date: true, minutes: true, billable: true },
    }),
    db.worklog.findMany({
      where: {
        userId: input.userId,
        issue: { workspaceId: input.workspaceId },
        date: { gte: start, lt: new Date(start.getTime() + 7 * DAY) },
      },
      select: { issueId: true, date: true },
    }),
  ]);
  const taken = new Set(current.map((w) => `${w.issueId}:${iso(w.date)}`));
  const today = Date.now();
  const sums = new Map<
    string,
    { issueId: string; date: Date; minutes: number; billable: boolean }
  >();
  for (const w of prev) {
    const date = new Date(w.date.getTime() + 7 * DAY);
    const key = `${w.issueId}:${iso(date)}`;
    if (taken.has(key) || date.getTime() > today) continue;
    const s = sums.get(key) ?? { issueId: w.issueId, date, minutes: 0, billable: w.billable };
    s.minutes += w.minutes;
    sums.set(key, s);
  }
  if (!sums.size) return { copied: 0 };
  await db.worklog.createMany({
    data: [...sums.values()].map((s) => ({
      issueId: s.issueId,
      userId: input.userId,
      date: s.date,
      minutes: Math.min(s.minutes, 24 * 60),
      billable: s.billable,
      note: "Copied from last week",
    })),
  });
  return { copied: sums.size };
}

/** Sends the user's week to admins for approval. */
export async function submitWeek(input: { userId: string; workspaceId: string; week: string }) {
  const weekStart = mondayOf(input.week);
  await assertWeekOpen(input.workspaceId, input.userId, weekStart);
  const agg = await db.worklog.aggregate({
    where: {
      userId: input.userId,
      issue: { workspaceId: input.workspaceId },
      date: { gte: weekStart, lt: new Date(weekStart.getTime() + 7 * DAY) },
    },
    _sum: { minutes: true },
  });
  const minutes = agg._sum.minutes ?? 0;
  if (!minutes) throw new AppError("validation_failed", "Log some time before submitting");
  await db.timesheetSubmission.upsert({
    where: {
      workspaceId_userId_weekStart: {
        workspaceId: input.workspaceId,
        userId: input.userId,
        weekStart,
      },
    },
    create: { workspaceId: input.workspaceId, userId: input.userId, weekStart, minutes },
    update: {
      minutes,
      status: "submitted",
      note: "",
      reviewerId: null,
      decidedAt: null,
      submittedAt: new Date(),
    },
  });
}

/** Admins approve or reject a submitted week. */
export async function decideTimesheet(input: {
  userId: string;
  workspaceId: string;
  submissionId: string;
  decision: "approved" | "rejected";
  note: string;
}) {
  const role = await roleIn(input.workspaceId, input.userId);
  if (!can(role, "members:update_role")) {
    throw new AppError("forbidden", "Only admins can approve timesheets");
  }
  const { count } = await db.timesheetSubmission.updateMany({
    where: { id: input.submissionId, workspaceId: input.workspaceId, status: "submitted" },
    data: {
      status: input.decision,
      reviewerId: input.userId,
      note: input.note,
      decidedAt: new Date(),
    },
  });
  if (!count) throw new AppError("conflict", "This timesheet was already decided");
}

export async function getSubmission(workspaceId: string, userId: string, week: Date) {
  return db.timesheetSubmission.findUnique({
    where: { workspaceId_userId_weekStart: { workspaceId, userId, weekStart: week } },
    select: { status: true, note: true, reviewer: { select: { name: true } } },
  });
}

/** Submitted weeks waiting for an admin, oldest first. */
export async function listPendingTimesheets(workspaceId: string) {
  return db.timesheetSubmission.findMany({
    where: { workspaceId, status: "submitted" },
    orderBy: { submittedAt: "asc" },
    take: 50,
    select: {
      id: true,
      weekStart: true,
      minutes: true,
      submittedAt: true,
      user: { select: { id: true, name: true, image: true } },
    },
  });
}

// ── Timer ──────────────────────────────────────────────────────────────────

export async function getTimer(userId: string) {
  const timer = await db.activeTimer.findUnique({
    where: { userId },
    select: {
      startedAt: true,
      issue: {
        select: { id: true, number: true, title: true, project: { select: { key: true } } },
      },
    },
  });
  return timer
    ? {
        startedAt: timer.startedAt.toISOString(),
        issue: {
          id: timer.issue.id,
          key: formatIssueKey(timer.issue.project.key, timer.issue.number),
          title: timer.issue.title,
        },
      }
    : null;
}

export async function startTimer(input: {
  userId: string;
  issueId?: string;
  issueKey?: string;
  workspaceId: string;
}) {
  let issueId = input.issueId;
  if (!issueId && input.issueKey) {
    const key = parseIssueKey(input.issueKey);
    const issue = key
      ? await db.issue.findFirst({
          where: {
            workspaceId: input.workspaceId,
            number: key.number,
            project: { key: key.projectKey },
          },
          select: { id: true },
        })
      : null;
    issueId = issue?.id;
  }
  if (!issueId) throw new AppError("not_found", "Issue not found");
  const issue = await db.issue.findFirst({
    where: { id: issueId, workspaceId: input.workspaceId },
    select: { id: true },
  });
  if (!issue) throw new AppError("not_found", "Issue not found");
  await assertWorkspacePermission(input.workspaceId, input.userId, "issues:update");
  await db.activeTimer.upsert({
    where: { userId: input.userId },
    create: { userId: input.userId, issueId: issue.id },
    update: { issueId: issue.id, startedAt: new Date() },
  });
}

/** Stops the timer; with `log`, records the elapsed time (at least a minute) for today. */
export async function stopTimer(input: { userId: string; log: boolean }) {
  const timer = await db.activeTimer.findUnique({ where: { userId: input.userId } });
  if (!timer) return { minutes: 0 };
  await db.activeTimer.delete({ where: { userId: input.userId } });
  const minutes = Math.max(
    1,
    Math.min(24 * 60, Math.round((Date.now() - timer.startedAt.getTime()) / 60_000)),
  );
  if (input.log) {
    await logWork({
      issueId: timer.issueId,
      userId: input.userId,
      minutes,
      date: iso(new Date()),
      note: "Timer",
    });
  }
  return { minutes };
}

export async function findIssueByKey(workspaceId: string, issueKey: string) {
  const key = parseIssueKey(issueKey.trim());
  if (!key) return null;
  const issue = await db.issue.findFirst({
    where: { workspaceId, number: key.number, project: { key: key.projectKey } },
    select: { id: true, title: true },
  });
  return issue ? { ...issue, key: formatIssueKey(key.projectKey, key.number) } : null;
}
