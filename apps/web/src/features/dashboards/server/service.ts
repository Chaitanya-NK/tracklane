import "server-only";
import { AppError, ROLE_RANK } from "@tracklane/core";
import { db } from "@tracklane/db";
import { assertWorkspacePermission } from "@/server/authz";
import { parseWidgets, type Widget } from "../widgets";

const summarySelect = {
  id: true,
  name: true,
  description: true,
  shared: true,
  updatedAt: true,
  ownerId: true,
  owner: { select: { name: true } },
  widgets: true,
} as const;

export async function listDashboards(workspaceId: string, userId: string) {
  const rows = await db.dashboard.findMany({
    where: { workspaceId, OR: [{ ownerId: userId }, { shared: true }] },
    orderBy: [{ name: "asc" }],
    select: summarySelect,
  });
  return rows.map((d) => ({ ...d, widgetCount: parseWidgets(d.widgets).length }));
}

/** A dashboard the user can see, plus whether they can change it (owner or admin). */
export async function getDashboard(workspaceId: string, userId: string, dashboardId: string) {
  const [dashboard, member] = await Promise.all([
    db.dashboard.findFirst({ where: { id: dashboardId, workspaceId }, select: summarySelect }),
    db.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
      select: { role: true },
    }),
  ]);
  if (!dashboard || (!dashboard.shared && dashboard.ownerId !== userId)) return null;
  const admin = member ? ROLE_RANK[member.role] >= ROLE_RANK.admin : false;
  return {
    ...dashboard,
    widgets: parseWidgets(dashboard.widgets),
    canEdit: dashboard.ownerId === userId || (dashboard.shared && admin),
  };
}

async function editable(workspaceId: string, userId: string, dashboardId: string) {
  const dashboard = await getDashboard(workspaceId, userId, dashboardId);
  if (!dashboard) throw new AppError("not_found", "Dashboard not found");
  if (!dashboard.canEdit)
    throw new AppError("forbidden", "Only its owner or an admin can change this dashboard");
  return dashboard;
}

export async function createDashboard(input: {
  workspaceId: string;
  userId: string;
  name: string;
  description: string;
  shared: boolean;
  widgets?: Widget[];
}) {
  await assertWorkspacePermission(input.workspaceId, input.userId, "workspace:read");
  return db.dashboard.create({
    data: {
      workspaceId: input.workspaceId,
      ownerId: input.userId,
      name: input.name,
      description: input.description,
      shared: input.shared,
      widgets: input.widgets ?? [],
    },
    select: { id: true, name: true },
  });
}

export async function updateDashboard(input: {
  workspaceId: string;
  userId: string;
  dashboardId: string;
  name: string;
  description: string;
  shared: boolean;
}) {
  await editable(input.workspaceId, input.userId, input.dashboardId);
  await db.dashboard.update({
    where: { id: input.dashboardId },
    data: { name: input.name, description: input.description, shared: input.shared },
  });
}

export async function saveWidgets(input: {
  workspaceId: string;
  userId: string;
  dashboardId: string;
  widgets: Widget[];
}) {
  await editable(input.workspaceId, input.userId, input.dashboardId);
  const ids = new Set(input.widgets.map((w) => w.id));
  if (ids.size !== input.widgets.length)
    throw new AppError("validation_failed", "Duplicate widget ids");
  await db.dashboard.update({ where: { id: input.dashboardId }, data: { widgets: input.widgets } });
}

export async function deleteDashboard(input: {
  workspaceId: string;
  userId: string;
  dashboardId: string;
}) {
  await editable(input.workspaceId, input.userId, input.dashboardId);
  await db.dashboard.delete({ where: { id: input.dashboardId } });
}
