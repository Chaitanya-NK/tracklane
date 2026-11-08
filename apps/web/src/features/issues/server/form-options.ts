import "server-only";
import { can, type WorkspaceRole } from "@tracklane/core";
import { db } from "@tracklane/db";
import { listAssignableUsers, listLabels, listStatuses } from "@/features/projects/server";
import type { IssueFormOptions } from "../types";

export async function loadIssueFormOptions(input: {
  workspaceId: string;
  project: { id: string; key: string; name: string };
  role: WorkspaceRole;
  userId: string;
}): Promise<IssueFormOptions> {
  const [statuses, assignees, labels, parents] = await Promise.all([
    listStatuses(input.project.id),
    listAssignableUsers(input.workspaceId),
    listLabels(input.project.id),
    db.issue.findMany({
      where: { projectId: input.project.id, type: { in: ["epic", "story", "task", "bug"] } },
      orderBy: { number: "desc" },
      take: 300,
      select: { id: true, number: true, title: true, type: true },
    }),
  ]);
  return {
    project: { id: input.project.id, key: input.project.key, name: input.project.name },
    statuses: statuses.map(({ id, name, category }) => ({ id, name, category })),
    assignees,
    labels,
    parents,
    currentUserId: input.userId,
    canCreate: can(input.role, "issues:create"),
    canEdit: can(input.role, "issues:update"),
  };
}
