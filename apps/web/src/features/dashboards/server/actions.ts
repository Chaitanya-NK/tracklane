"use server";

import type { Route } from "next";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getWorkspaceAccess } from "@/server/authz";
import { authActionClient } from "@/server/safe-action";
import { widgetsSchema } from "../widgets";
import { createDashboard, deleteDashboard, saveWidgets, updateDashboard } from "./service";

const meta = {
  name: z.string().trim().min(1, "Name the dashboard").max(80),
  description: z.string().trim().max(300),
  shared: z.boolean(),
};

export const createDashboardAction = authActionClient
  .inputSchema(z.object({ slug: z.string(), ...meta, widgets: widgetsSchema.optional() }))
  .action(async ({ parsedInput: { slug, ...rest }, ctx }) => {
    const { workspace } = await getWorkspaceAccess(slug);
    const dashboard = await createDashboard({
      workspaceId: workspace.id,
      userId: ctx.user.id,
      ...rest,
    });
    redirect(`/${slug}/dashboards/${dashboard.id}?edit=1` as Route);
  });

export const updateDashboardAction = authActionClient
  .inputSchema(z.object({ slug: z.string(), dashboardId: z.string(), ...meta }))
  .action(async ({ parsedInput: { slug, ...rest }, ctx }) => {
    const { workspace } = await getWorkspaceAccess(slug);
    await updateDashboard({ workspaceId: workspace.id, userId: ctx.user.id, ...rest });
    refresh();
  });

export const saveWidgetsAction = authActionClient
  .inputSchema(z.object({ slug: z.string(), dashboardId: z.string(), widgets: widgetsSchema }))
  .action(async ({ parsedInput: { slug, ...rest }, ctx }) => {
    const { workspace } = await getWorkspaceAccess(slug);
    await saveWidgets({ workspaceId: workspace.id, userId: ctx.user.id, ...rest });
    refresh();
  });

export const deleteDashboardAction = authActionClient
  .inputSchema(z.object({ slug: z.string(), dashboardId: z.string() }))
  .action(async ({ parsedInput: { slug, dashboardId }, ctx }) => {
    const { workspace } = await getWorkspaceAccess(slug);
    await deleteDashboard({ workspaceId: workspace.id, userId: ctx.user.id, dashboardId });
    redirect(`/${slug}/dashboards` as Route);
  });
