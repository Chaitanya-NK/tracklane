import "server-only";
import { AppError, can, type WorkspaceRole } from "@tracklane/core";
import { db } from "@tracklane/db";

const viewSelect = {
  id: true,
  name: true,
  params: true,
  groupBy: true,
  columns: true,
  shared: true,
  editable: true,
  isDefault: true,
  ownerId: true,
  owner: { select: { name: true } },
} as const;

export interface ViewInput {
  name: string;
  params: string;
  groupBy: string;
  columns: string[];
}

export interface ViewSharing {
  shared: boolean;
  editable: boolean;
  isDefault: boolean;
}

/** Views the user can see in a project: their own and shared ones. Default first. */
export async function listViews(projectId: string, userId: string) {
  const views = await db.projectView.findMany({
    where: { projectId, OR: [{ ownerId: userId }, { shared: true }] },
    orderBy: [{ isDefault: "desc" }, { position: "asc" }, { createdAt: "asc" }],
    select: viewSelect,
  });
  return views.map((v) => ({ ...v, mine: v.ownerId === userId }));
}

export type ViewItem = Awaited<ReturnType<typeof listViews>>[number];

/** Strips the view/page parameters so a view stores only filters. */
export function normalizeParams(params: string): string {
  const search = new URLSearchParams(params.replace(/^\?/, ""));
  for (const key of ["view", "page", "group", "cols"]) search.delete(key);
  search.sort();
  return search.toString();
}

async function loadEditable(viewId: string, projectId: string, userId: string) {
  const view = await db.projectView.findFirst({
    where: { id: viewId, projectId },
    select: { id: true, ownerId: true, shared: true, editable: true },
  });
  if (!view || (view.ownerId !== userId && !view.shared)) {
    throw new AppError("not_found", "View not found");
  }
  return view;
}

export async function createView(input: {
  projectId: string;
  userId: string;
  role: WorkspaceRole;
  view: ViewInput;
  sharing: ViewSharing;
}) {
  if (input.sharing.isDefault && !can(input.role, "projects:update")) {
    throw new AppError("forbidden", "Only project admins can set the team default view");
  }
  const count = await db.projectView.count({ where: { projectId: input.projectId } });
  return db.$transaction(async (tx) => {
    if (input.sharing.isDefault) {
      await tx.projectView.updateMany({
        where: { projectId: input.projectId },
        data: { isDefault: false },
      });
    }
    return tx.projectView.create({
      data: {
        projectId: input.projectId,
        ownerId: input.userId,
        ...input.view,
        params: normalizeParams(input.view.params),
        shared: input.sharing.shared || input.sharing.isDefault,
        editable: input.sharing.editable,
        isDefault: input.sharing.isDefault,
        position: count,
      },
      select: { id: true },
    });
  });
}

/** Saves the current filters/grouping/columns into a view (owner, or anyone if editable). */
export async function saveView(input: {
  projectId: string;
  userId: string;
  viewId: string;
  view: ViewInput;
}) {
  const view = await loadEditable(input.viewId, input.projectId, input.userId);
  if (view.ownerId !== input.userId && !view.editable) {
    throw new AppError("forbidden", "Only the owner can change this view — save it as a new one");
  }
  await db.projectView.update({
    where: { id: view.id },
    data: { ...input.view, params: normalizeParams(input.view.params) },
  });
}

/** Renames and changes who sees a view. Owner only (or a project admin). */
export async function updateViewSharing(input: {
  projectId: string;
  userId: string;
  role: WorkspaceRole;
  viewId: string;
  name: string;
  sharing: ViewSharing;
}) {
  const view = await loadEditable(input.viewId, input.projectId, input.userId);
  const admin = can(input.role, "projects:update");
  if (view.ownerId !== input.userId && !admin) {
    throw new AppError("forbidden", "Only the owner can change how this view is shared");
  }
  if (input.sharing.isDefault && !admin) {
    throw new AppError("forbidden", "Only project admins can set the team default view");
  }
  await db.$transaction(async (tx) => {
    if (input.sharing.isDefault) {
      await tx.projectView.updateMany({
        where: { projectId: input.projectId, id: { not: view.id } },
        data: { isDefault: false },
      });
    }
    await tx.projectView.update({
      where: { id: view.id },
      data: {
        name: input.name,
        shared: input.sharing.shared || input.sharing.isDefault,
        editable: input.sharing.editable,
        isDefault: input.sharing.isDefault,
      },
    });
  });
}

export async function deleteView(input: {
  projectId: string;
  userId: string;
  role: WorkspaceRole;
  viewId: string;
}) {
  const view = await loadEditable(input.viewId, input.projectId, input.userId);
  if (view.ownerId !== input.userId && !can(input.role, "projects:update")) {
    throw new AppError("forbidden", "Only the owner can delete this view");
  }
  await db.projectView.delete({ where: { id: view.id } });
}
