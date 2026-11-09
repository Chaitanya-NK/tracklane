import { db } from "./client";

const todayUtc = (now = new Date()) =>
  new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

/**
 * Today's numbers for a project: issues per status and category, and the active sprint's
 * scope and remaining points. Shared by the worker (which stores them daily) and the reports
 * (which draw "today" live).
 */
export async function measureProject(projectId: string) {
  const [statuses, sprint] = await Promise.all([
    db.workflowStatus.findMany({
      where: { projectId },
      select: { id: true, category: true, _count: { select: { issues: true } } },
    }),
    db.sprint.findFirst({ where: { projectId, state: "active" }, select: { id: true } }),
  ]);
  const statusCounts = Object.fromEntries(statuses.map((s) => [s.id, s._count.issues]));
  const byCategory = (category: string) =>
    statuses.filter((s) => s.category === category).reduce((n, s) => n + s._count.issues, 0);
  let sprintScope = 0;
  let sprintRemaining = 0;
  let sprintIssues = 0;
  let sprintOpenIssues = 0;
  if (sprint) {
    const issues = await db.issue.findMany({
      where: { sprintId: sprint.id, type: { not: "subtask" } },
      select: { estimate: true, status: { select: { category: true } } },
    });
    for (const issue of issues) {
      sprintScope += issue.estimate ?? 0;
      sprintIssues++;
      if (issue.status.category !== "done") {
        sprintRemaining += issue.estimate ?? 0;
        sprintOpenIssues++;
      }
    }
  }
  return {
    statusCounts,
    todoCount: byCategory("todo"),
    inProgressCount: byCategory("in_progress"),
    doneCount: byCategory("done"),
    sprintId: sprint?.id ?? null,
    sprintScope,
    sprintRemaining,
    sprintIssues,
    sprintOpenIssues,
  };
}

/** Stores today's measurement (idempotent: re-running in the same UTC day overwrites it). */
export async function snapshotProject(projectId: string, now = new Date()) {
  const date = todayUtc(now);
  const data = await measureProject(projectId);
  await db.projectSnapshot.upsert({
    where: { projectId_date: { projectId, date } },
    update: data,
    create: { projectId, date, ...data },
  });
}

/** Snapshots every active project. Returns how many. */
export async function snapshotAllProjects(now = new Date()) {
  const projects = await db.project.findMany({ where: { archivedAt: null }, select: { id: true } });
  for (const project of projects) await snapshotProject(project.id, now);
  return projects.length;
}
