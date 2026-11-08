import "server-only";
import { db } from "@tracklane/db";

export interface ProjectListItem {
  id: string;
  key: string;
  name: string;
  type: "scrum" | "kanban";
  lead: { id: string; name: string; image: string | null } | null;
  openIssues: number;
  totalIssues: number;
  updatedAt: Date;
}

/** Active projects in a workspace with issue counts, most recently updated first. */
export async function listProjects(workspaceId: string): Promise<ProjectListItem[]> {
  const projects = await db.project.findMany({
    where: { workspaceId, archivedAt: null },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      key: true,
      name: true,
      type: true,
      updatedAt: true,
      lead: { select: { id: true, name: true, image: true } },
      _count: { select: { issues: true } },
    },
  });
  const open = await db.issue.groupBy({
    by: ["projectId"],
    where: { workspaceId, status: { category: { not: "done" } } },
    _count: { _all: true },
  });
  const openByProject = new Map(open.map((row) => [row.projectId, row._count._all]));
  return projects.map((p) => ({
    id: p.id,
    key: p.key,
    name: p.name,
    type: p.type,
    lead: p.lead,
    updatedAt: p.updatedAt,
    totalIssues: p._count.issues,
    openIssues: openByProject.get(p.id) ?? 0,
  }));
}

/** Workflow statuses in board order. */
export function listStatuses(projectId: string) {
  return db.workflowStatus.findMany({
    where: { projectId },
    orderBy: { position: "asc" },
    select: { id: true, name: true, category: true, position: true },
  });
}

export function listLabels(projectId: string) {
  return db.label.findMany({
    where: { projectId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, color: true },
  });
}

/** People who can be assigned issues: workspace members other than guests. */
export async function listAssignableUsers(workspaceId: string) {
  const members = await db.workspaceMember.findMany({
    where: { workspaceId, role: { not: "guest" } },
    orderBy: { user: { name: "asc" } },
    select: { user: { select: { id: true, name: true, email: true, image: true } } },
  });
  return members.map((m) => m.user);
}
