import "server-only";
import { formatIssueKey } from "@tracklane/core";
import { db, type Prisma } from "@tracklane/db";
import type { CalendarIssue } from "../types";

const select = {
  id: true,
  number: true,
  title: true,
  type: true,
  priority: true,
  dueDate: true,
  status: { select: { name: true, category: true } },
} satisfies Prisma.IssueSelect;

/** Issues due within [from, to] plus open issues without a due date (to drag onto the calendar). */
export async function getCalendar(project: { id: string; key: string }, from: string, to: string) {
  const [scheduled, unscheduled, sprints] = await Promise.all([
    db.issue.findMany({
      where: {
        projectId: project.id,
        dueDate: { gte: new Date(`${from}T00:00:00Z`), lte: new Date(`${to}T00:00:00Z`) },
      },
      orderBy: [{ priority: "desc" }, { number: "asc" }],
      select,
    }),
    db.issue.findMany({
      where: {
        projectId: project.id,
        dueDate: null,
        status: { category: { not: "done" } },
        type: { not: "epic" },
      },
      orderBy: [{ priority: "desc" }, { number: "asc" }],
      take: 100,
      select,
    }),
    db.sprint.findMany({
      where: {
        projectId: project.id,
        startDate: { lte: new Date(`${to}T00:00:00Z`) },
        endDate: { gte: new Date(`${from}T00:00:00Z`) },
      },
      orderBy: { startDate: "asc" },
      select: { name: true, startDate: true, endDate: true, state: true },
    }),
  ]);
  const toItem = (i: (typeof scheduled)[number]): CalendarIssue => ({
    id: i.id,
    key: formatIssueKey(project.key, i.number),
    title: i.title,
    type: i.type,
    priority: i.priority,
    status: i.status,
    due: i.dueDate ? i.dueDate.toISOString().slice(0, 10) : null,
  });
  return {
    scheduled: scheduled.map(toItem),
    unscheduled: unscheduled.map(toItem),
    sprints: sprints.map((s) => ({
      name: s.name,
      state: s.state,
      start: s.startDate!.toISOString().slice(0, 10),
      end: s.endDate!.toISOString().slice(0, 10),
    })),
  };
}
