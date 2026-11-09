import "server-only";
import { can, type WorkspaceRole } from "@tracklane/core";
import { db } from "@tracklane/db";
import { listAssignableUsers, listLabels, listStatuses } from "@/features/projects/server";
import { listCustomFields } from "@/features/custom-fields/server";
import { listOpenSprints } from "@/features/sprints/server";
import { getTransitionRules } from "@/features/workflow/server/queries";
import type { IssueFormOptions } from "../types";

export async function loadIssueFormOptions(input: {
  workspaceId: string;
  project: { id: string; key: string; name: string; type: "scrum" | "kanban" };
  role: WorkspaceRole;
  userId: string;
}): Promise<IssueFormOptions> {
  const [
    statuses,
    assignees,
    labels,
    parents,
    sprints,
    transitions,
    customFields,
    resolutions,
    customTypes,
    releases,
  ] = await Promise.all([
    listStatuses(input.project.id),
    listAssignableUsers(input.workspaceId),
    listLabels(input.project.id),
    db.issue.findMany({
      where: { projectId: input.project.id, type: { in: ["epic", "story", "task", "bug"] } },
      orderBy: { number: "desc" },
      take: 300,
      select: { id: true, number: true, title: true, type: true },
    }),
    input.project.type === "scrum" ? listOpenSprints(input.project.id) : Promise.resolve([]),
    getTransitionRules(input.project.id),
    listCustomFields(input.project.id),
    db.resolution.findMany({
      where: { workspaceId: input.workspaceId },
      orderBy: { position: "asc" },
      select: { id: true, name: true, description: true, isDefault: true },
    }),
    db.projectIssueType.findMany({
      where: { projectId: input.project.id },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      select: { id: true, name: true, baseType: true, color: true, icon: true },
    }),
    db.release.findMany({
      where: { projectId: input.project.id, status: { not: "archived" } },
      orderBy: [
        { status: "asc" },
        { releaseDate: { sort: "desc", nulls: "first" } },
        { createdAt: "desc" },
      ],
      take: 40,
      select: { id: true, name: true, status: true },
    }),
  ]);
  return {
    project: {
      id: input.project.id,
      key: input.project.key,
      name: input.project.name,
      type: input.project.type,
    },
    sprints,
    statuses: statuses.map(({ id, name, category }) => ({ id, name, category })),
    assignees,
    labels,
    parents,
    transitions,
    customFields,
    resolutions,
    customTypes,
    releases,
    currentUserId: input.userId,
    canCreate: can(input.role, "issues:create"),
    canEdit: can(input.role, "issues:update"),
  };
}
