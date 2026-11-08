import "server-only";
import { AppError, can, type Permission, type WorkspaceRole } from "@tracklane/core";
import { db } from "@tracklane/db";
import { notFound } from "next/navigation";
import { cache } from "react";
import { requireUser, type CurrentUser } from "./auth";

export interface WorkspaceAccess {
  user: CurrentUser;
  workspace: { id: string; name: string; slug: string };
  role: WorkspaceRole;
}

/**
 * Resolves the signed-in user's membership in a workspace by slug, for pages and layouts.
 * Renders a 404 (not a 403) for workspaces the user can't see, so their existence isn't revealed.
 */
export const getWorkspaceAccess = cache(async (slug: string): Promise<WorkspaceAccess> => {
  const user = await requireUser();
  const membership = await db.workspaceMember.findFirst({
    where: { userId: user.id, workspace: { slug } },
    select: { role: true, workspace: { select: { id: true, name: true, slug: true } } },
  });
  if (!membership) notFound();
  return { user, workspace: membership.workspace, role: membership.role };
});

/** For services and API handlers: throws an AppError instead of rendering a page. */
export async function assertWorkspacePermission(
  workspaceId: string,
  userId: string,
  permission: Permission,
): Promise<WorkspaceRole> {
  const membership = await db.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    select: { role: true },
  });
  if (!membership) throw new AppError("not_found", "Workspace not found");
  if (!can(membership.role, permission)) {
    throw new AppError("forbidden", "You don't have permission to do that in this workspace");
  }
  return membership.role;
}

export interface ProjectAccess extends WorkspaceAccess {
  project: {
    id: string;
    key: string;
    name: string;
    description: string;
    type: "scrum" | "kanban";
    leadId: string | null;
    archivedAt: Date | null;
  };
}

/** Workspace access plus a project in it, looked up by key ("PAY"). 404 if either is missing. */
export const getProjectAccess = cache(
  async (workspaceSlug: string, projectKey: string): Promise<ProjectAccess> => {
    const access = await getWorkspaceAccess(workspaceSlug);
    const project = await db.project.findUnique({
      where: {
        workspaceId_key: { workspaceId: access.workspace.id, key: projectKey.toUpperCase() },
      },
      select: {
        id: true,
        key: true,
        name: true,
        description: true,
        type: true,
        leadId: true,
        archivedAt: true,
      },
    });
    if (!project) notFound();
    return { ...access, project };
  },
);
