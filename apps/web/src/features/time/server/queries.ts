import "server-only";
import { formatIssueKey } from "@tracklane/core";
import { db } from "@tracklane/db";

export async function getIssueTime(issueId: string) {
  const [issue, worklogs] = await Promise.all([
    db.issue.findUniqueOrThrow({ where: { id: issueId }, select: { timeEstimate: true } }),
    db.worklog.findMany({
      where: { issueId },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        minutes: true,
        date: true,
        note: true,
        createdAt: true,
        user: { select: { id: true, name: true, image: true } },
      },
    }),
  ]);
  return {
    estimate: issue.timeEstimate,
    logged: worklogs.reduce((sum, w) => sum + w.minutes, 0),
    worklogs,
  };
}

export type IssueTime = Awaited<ReturnType<typeof getIssueTime>>;

/** Monday 00:00 UTC of the week containing `date`. */
export function weekStart(date: Date) {
  const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const weekday = (day.getUTCDay() + 6) % 7;
  return new Date(day.getTime() - weekday * 86_400_000);
}

/**
 * A week of logged time in a workspace: one row per person and issue with minutes per day
 * (Monday first). Optionally for one person.
 */
export async function getTimesheet(input: {
  workspaceId: string;
  start: Date;
  userId?: string;
  projectId?: string;
}) {
  const end = new Date(input.start.getTime() + 7 * 86_400_000);
  const worklogs = await db.worklog.findMany({
    where: {
      date: { gte: input.start, lt: end },
      issue: {
        workspaceId: input.workspaceId,
        ...(input.projectId ? { projectId: input.projectId } : {}),
      },
      ...(input.userId ? { userId: input.userId } : {}),
    },
    select: {
      minutes: true,
      date: true,
      billable: true,
      user: { select: { id: true, name: true, image: true } },
      issue: {
        select: {
          id: true,
          number: true,
          title: true,
          type: true,
          project: { select: { key: true } },
        },
      },
    },
  });
  const rows = new Map<
    string,
    {
      user: { id: string; name: string; image: string | null } | null;
      issue: { id: string; key: string; title: string; type: string };
      days: number[];
      total: number;
      /** Minutes marked billable. */
      billableMinutes: number;
    }
  >();
  for (const w of worklogs) {
    const key = `${w.user?.id ?? "former"}:${w.issue.id}`;
    const row = rows.get(key) ?? {
      user: w.user,
      issue: {
        id: w.issue.id,
        key: formatIssueKey(w.issue.project.key, w.issue.number),
        title: w.issue.title,
        type: w.issue.type,
      },
      days: [0, 0, 0, 0, 0, 0, 0],
      total: 0,
      billableMinutes: 0,
    };
    const index = Math.floor((w.date.getTime() - input.start.getTime()) / 86_400_000);
    row.days[index] = (row.days[index] ?? 0) + w.minutes;
    row.total += w.minutes;
    if (w.billable) row.billableMinutes += w.minutes;
    rows.set(key, row);
  }
  return [...rows.values()].sort(
    (a, b) =>
      (a.user?.name ?? "").localeCompare(b.user?.name ?? "") ||
      a.issue.key.localeCompare(b.issue.key, undefined, { numeric: true }),
  );
}

export type TimesheetRow = Awaited<ReturnType<typeof getTimesheet>>[number];
