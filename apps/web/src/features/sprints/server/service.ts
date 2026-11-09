import "server-only";
import { AppError } from "@tracklane/core";
import { db } from "@tracklane/db";
import { assertWorkspacePermission } from "@/server/authz";
import { enqueueWebhooks } from "@/server/webhooks/enqueue";

const DEFAULT_SPRINT_DAYS = 14;
const DAY = 24 * 60 * 60 * 1000;

const toDate = (value: string) => new Date(`${value}T00:00:00Z`);
const todayUtc = () => new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z");

async function loadSprint(sprintId: string) {
  const sprint = await db.sprint.findUnique({
    where: { id: sprintId },
    select: {
      id: true,
      state: true,
      projectId: true,
      name: true,
      project: { select: { workspaceId: true, key: true } },
    },
  });
  if (!sprint) throw new AppError("not_found", "Sprint not found");
  return sprint;
}

async function authorize(sprintId: string, userId: string) {
  const sprint = await loadSprint(sprintId);
  await assertWorkspacePermission(sprint.project.workspaceId, userId, "sprints:manage");
  return sprint;
}

export async function createSprint(input: {
  workspaceId: string;
  projectId: string;
  userId: string;
}) {
  await assertWorkspacePermission(input.workspaceId, input.userId, "sprints:manage");
  return db.$transaction(async (tx) => {
    const project = await tx.project.update({
      where: { id: input.projectId, workspaceId: input.workspaceId },
      data: { sprintCounter: { increment: 1 } },
      select: { key: true, sprintCounter: true },
    });
    return tx.sprint.create({
      data: { projectId: input.projectId, name: `${project.key} Sprint ${project.sprintCounter}` },
      select: { id: true, name: true },
    });
  });
}

export async function updateSprint(input: {
  sprintId: string;
  userId: string;
  name: string;
  goal: string;
  startDate: string | null;
  endDate: string | null;
}) {
  const sprint = await authorize(input.sprintId, input.userId);
  if (sprint.state === "completed")
    throw new AppError("conflict", "Completed sprints can't be edited");
  if (input.startDate && input.endDate && input.endDate < input.startDate) {
    throw new AppError("validation_failed", "The end date must be after the start date", {
      field: "endDate",
    });
  }
  await db.sprint.update({
    where: { id: sprint.id },
    data: {
      name: input.name,
      goal: input.goal,
      startDate: input.startDate ? toDate(input.startDate) : null,
      endDate: input.endDate ? toDate(input.endDate) : null,
    },
  });
}

export async function startSprint(input: {
  sprintId: string;
  userId: string;
  name: string;
  goal: string;
  startDate: string;
  endDate: string;
}) {
  const sprint = await authorize(input.sprintId, input.userId);
  if (sprint.state !== "planned")
    throw new AppError("conflict", "Only planned sprints can be started");
  if (input.endDate < input.startDate) {
    throw new AppError("validation_failed", "The end date must be after the start date", {
      field: "endDate",
    });
  }
  return db.$transaction(async (tx) => {
    const active = await tx.sprint.findFirst({
      where: { projectId: sprint.projectId, state: "active" },
      select: { name: true },
    });
    if (active)
      throw new AppError("conflict", `${active.name} is still active. Complete it first.`);
    const points = await tx.issue.aggregate({
      where: { sprintId: sprint.id },
      _sum: { estimate: true },
    });
    await tx.sprint.update({
      where: { id: sprint.id },
      data: {
        name: input.name,
        goal: input.goal,
        state: "active",
        startDate: toDate(input.startDate),
        endDate: toDate(input.endDate),
        startedAt: new Date(),
        committedPoints: points._sum.estimate ?? 0,
      },
    });
    await enqueueWebhooks(tx, sprint.project.workspaceId, "sprint.started", {
      sprint: {
        id: sprint.id,
        name: input.name,
        goal: input.goal,
        startDate: input.startDate,
        endDate: input.endDate,
        committedPoints: points._sum.estimate ?? 0,
      },
      project: { id: sprint.projectId, key: sprint.project.key },
    });
  });
}

/** Default dates for the start dialog: today and two weeks later. */
export function defaultSprintDates() {
  const start = todayUtc();
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: new Date(start.getTime() + DEFAULT_SPRINT_DAYS * DAY).toISOString().slice(0, 10),
  };
}

/**
 * Completes the active sprint. Done issues stay in it (they form the sprint report); open issues
 * move to the backlog or another planned sprint. Returns the counts for the confirmation toast.
 */
export async function completeSprint(input: {
  sprintId: string;
  userId: string;
  moveOpenTo: string | null;
}) {
  const sprint = await authorize(input.sprintId, input.userId);
  if (sprint.state !== "active")
    throw new AppError("conflict", "Only the active sprint can be completed");
  return db.$transaction(async (tx) => {
    if (input.moveOpenTo) {
      const target = await tx.sprint.findFirst({
        where: { id: input.moveOpenTo, projectId: sprint.projectId, state: "planned" },
        select: { id: true },
      });
      if (!target) throw new AppError("validation_failed", "Pick a planned sprint in this project");
    }
    const issues = await tx.issue.findMany({
      where: { sprintId: sprint.id },
      select: { id: true, estimate: true, status: { select: { category: true } } },
    });
    const done = issues.filter((i) => i.status.category === "done");
    const open = issues.filter((i) => i.status.category !== "done");
    if (open.length) {
      await tx.issue.updateMany({
        where: { id: { in: open.map((i) => i.id) } },
        data: { sprintId: input.moveOpenTo },
      });
    }
    await tx.sprint.update({
      where: { id: sprint.id },
      data: {
        state: "completed",
        completedAt: new Date(),
        completedIssues: done.length,
        incompleteIssues: open.length,
        completedPoints: done.reduce((sum, i) => sum + (i.estimate ?? 0), 0),
      },
    });
    await enqueueWebhooks(tx, sprint.project.workspaceId, "sprint.completed", {
      sprint: {
        id: sprint.id,
        name: sprint.name,
        completedIssues: done.length,
        incompleteIssues: open.length,
        completedPoints: done.reduce((sum, i) => sum + (i.estimate ?? 0), 0),
      },
      project: { id: sprint.projectId, key: sprint.project.key },
    });
    return { name: sprint.name, completed: done.length, moved: open.length };
  });
}

/** Deletes a planned sprint; its issues go back to the backlog. */
export async function deleteSprint(input: { sprintId: string; userId: string }) {
  const sprint = await authorize(input.sprintId, input.userId);
  if (sprint.state !== "planned")
    throw new AppError("conflict", "Only planned sprints can be deleted");
  await db.sprint.delete({ where: { id: sprint.id } });
  return { name: sprint.name };
}
