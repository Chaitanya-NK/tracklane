import "server-only";
import { formatIssueKey } from "@tracklane/core";
import { db, type Prisma } from "@tracklane/db";
import { issueListSelect } from "@/features/issues/server";
import { averageVelocity } from "../capacity";

/** Issue fields shown on board cards and backlog rows. */
export const planningIssueSelect = {
  ...issueListSelect,
  position: true,
  sprintId: true,
  parent: { select: { id: true, number: true, title: true, type: true } },
  flagged: true,
  children: { select: { status: { select: { category: true } } } },
  // Open issues blocking this one.
  linksIn: {
    where: { type: "blocks", source: { status: { category: { not: "done" } } } },
    select: { source: { select: { number: true, project: { select: { key: true } } } } },
  },
} satisfies Prisma.IssueSelect;

export type PlanningIssue = Prisma.IssueGetPayload<{ select: typeof planningIssueSelect }>;

const sprintSelect = {
  id: true,
  name: true,
  goal: true,
  state: true,
  startDate: true,
  endDate: true,
  startedAt: true,
  completedAt: true,
  committedPoints: true,
  capacities: { select: { userId: true, daysOff: true, points: true } },
} satisfies Prisma.SprintSelect;

export type SprintSummary = Prisma.SprintGetPayload<{ select: typeof sprintSelect }>;

/** Active and planned sprints (in that order), plus the backlog, each with issues by rank. */
export async function getBacklog(projectId: string) {
  const [sprints, issues] = await Promise.all([
    db.sprint.findMany({
      where: { projectId, state: { in: ["active", "planned"] } },
      orderBy: [{ state: "asc" }, { createdAt: "asc" }],
      select: sprintSelect,
    }),
    db.issue.findMany({
      where: {
        projectId,
        // Epics plan across sprints; subtasks travel with their parent. Neither is a backlog row.
        type: { notIn: ["epic", "subtask"] },
        OR: [{ sprintId: null }, { sprint: { state: { in: ["active", "planned"] } } }],
      },
      orderBy: [{ position: "asc" }, { number: "asc" }],
      select: planningIssueSelect,
    }),
  ]);
  // Postgres sorts the enum in declaration order: planned, active, completed. Active first.
  sprints.sort((a, b) => (a.state === b.state ? 0 : a.state === "active" ? -1 : 1));
  return {
    sprints: sprints.map((sprint) => ({
      ...sprint,
      issues: issues.filter((i) => i.sprintId === sprint.id),
    })),
    // Done issues without a sprint are history, not backlog.
    backlog: issues.filter((i) => i.sprintId === null && i.status.category !== "done"),
  };
}

export function getActiveSprint(projectId: string) {
  return db.sprint.findFirst({ where: { projectId, state: "active" }, select: sprintSelect });
}

const KANBAN_DONE_WINDOW_DAYS = 14;

/**
 * Issues on the board: the active sprint for Scrum projects; for Kanban, everything open plus
 * recently finished work. Epics live in the backlog/timeline, not on the board.
 */
export async function getBoardIssues(
  project: { id: string; type: "scrum" | "kanban"; backlogStatusId?: string | null },
  sprintId: string | null,
) {
  if (project.type === "scrum" && !sprintId) return [];
  const doneSince = new Date(Date.now() - KANBAN_DONE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  return db.issue.findMany({
    where: {
      projectId: project.id,
      type: { not: "epic" },
      ...(project.type === "scrum"
        ? { sprintId }
        : {
            OR: [{ status: { category: { not: "done" } } }, { resolvedAt: { gte: doneSince } }],
            // The Kanban backlog lives in its own tab.
            ...(project.backlogStatusId ? { statusId: { not: project.backlogStatusId } } : {}),
          }),
    },
    orderBy: [{ position: "asc" }, { number: "asc" }],
    select: planningIssueSelect,
  });
}

/** Kanban backlog: issues waiting in the backlog status, by rank (epics excluded). */
export function getKanbanBacklog(projectId: string, backlogStatusId: string) {
  return db.issue.findMany({
    where: { projectId, statusId: backlogStatusId, type: { not: "epic" } },
    orderBy: [{ position: "asc" }, { number: "asc" }],
    select: planningIssueSelect,
  });
}

/** Sprints an issue can be put in (for pickers). */
export function listOpenSprints(projectId: string) {
  return db.sprint.findMany({
    where: { projectId, state: { in: ["active", "planned"] } },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, state: true },
  });
}

/** Average completed points of the last three completed sprints (null without history). */
export async function getVelocity(projectId: string): Promise<number | null> {
  const sprints = await db.sprint.findMany({
    where: { projectId, state: "completed" },
    orderBy: { completedAt: "desc" },
    take: 3,
    select: { completedPoints: true },
  });
  return averageVelocity(sprints.map((s) => s.completedPoints));
}

/** The project's open epics with child progress, for the backlog's epic panel. */
export async function listEpics(projectId: string) {
  const epics = await db.issue.findMany({
    where: { projectId, type: "epic" },
    orderBy: [{ position: "asc" }, { number: "asc" }],
    select: {
      id: true,
      number: true,
      title: true,
      project: { select: { key: true } },
      status: { select: { category: true } },
      children: { select: { estimate: true, status: { select: { category: true } } } },
    },
  });
  return epics.map((e) => ({
    id: e.id,
    key: formatIssueKey(e.project.key, e.number),
    title: e.title,
    done: e.status.category === "done",
    total: e.children.length,
    completed: e.children.filter((c) => c.status.category === "done").length,
    points: e.children.reduce((sum, c) => sum + (c.estimate ?? 0), 0),
  }));
}
