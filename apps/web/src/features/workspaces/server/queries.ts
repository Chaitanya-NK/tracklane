import "server-only";
import type { WorkspaceRole } from "@tracklane/core";
import { db } from "@tracklane/db";
import { cache } from "react";

export interface WorkspaceSummary {
  id: string;
  name: string;
  slug: string;
  role: WorkspaceRole;
}

/** Workspaces the user belongs to, oldest membership first. */
export const listUserWorkspaces = cache(async (userId: string): Promise<WorkspaceSummary[]> => {
  const memberships = await db.workspaceMember.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: { role: true, workspace: { select: { id: true, name: true, slug: true } } },
  });
  return memberships.map((m) => ({ ...m.workspace, role: m.role }));
});

/** Where "/" should send a signed-in user: their last workspace, else their first one. */
export async function getDefaultWorkspaceSlug(userId: string): Promise<string | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { lastWorkspaceId: true },
  });
  if (user?.lastWorkspaceId) {
    const last = await db.workspaceMember.findFirst({
      where: { userId, workspaceId: user.lastWorkspaceId },
      select: { workspace: { select: { slug: true } } },
    });
    if (last) return last.workspace.slug;
  }
  const first = await db.workspaceMember.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: { workspace: { select: { slug: true } } },
  });
  return first?.workspace.slug ?? null;
}
